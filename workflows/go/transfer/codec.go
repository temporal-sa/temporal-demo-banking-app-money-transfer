package transfer

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"os"
	"slices"
	"strings"

	commonpb "go.temporal.io/api/common/v1"
	"go.temporal.io/sdk/converter"
	"google.golang.org/protobuf/proto"
)

// Demo-only key, shared with the codec server. In production, use a key
// management system.
const (
	encryptionKey   = "banking-demo-encryption-key-32b!"
	encryptionKeyID = "banking-demo-key"
	encryptedFormat = "binary/encrypted"
	nonceSize       = 12
)

// EncryptionEnabled reports whether BANKING_ENCRYPT asks for payload encryption.
func EncryptionEnabled() bool {
	return slices.Contains([]string{"1", "true", "yes", "on"}, strings.ToLower(os.Getenv("BANKING_ENCRYPT")))
}

// EncryptionCodec encrypts payloads with AES-GCM before they reach Temporal.
type EncryptionCodec struct {
	aead cipher.AEAD
}

// NewEncryptionCodec returns the codec. It panics only if the constant key is bad.
func NewEncryptionCodec() *EncryptionCodec {
	block, err := aes.NewCipher([]byte(encryptionKey))
	if err != nil {
		panic(err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		panic(err)
	}
	return &EncryptionCodec{aead: aead}
}

var _ converter.PayloadCodec = (*EncryptionCodec)(nil)

// Encode encrypts each whole payload, metadata included.
func (c *EncryptionCodec) Encode(payloads []*commonpb.Payload) ([]*commonpb.Payload, error) {
	encoded := make([]*commonpb.Payload, len(payloads))
	for i, payload := range payloads {
		plain, err := proto.Marshal(payload)
		if err != nil {
			return nil, err
		}
		nonce := make([]byte, nonceSize)
		if _, err := rand.Read(nonce); err != nil {
			return nil, err
		}
		encoded[i] = &commonpb.Payload{
			Metadata: map[string][]byte{
				"encoding":          []byte(encryptedFormat),
				"encryption-key-id": []byte(encryptionKeyID),
			},
			Data: c.aead.Seal(nonce, nonce, plain, nil),
		}
	}
	return encoded, nil
}

// Decode decrypts encrypted payloads. The API doesn't use the codec, so
// Workflow input arrives in plain JSON and passes straight through.
func (c *EncryptionCodec) Decode(payloads []*commonpb.Payload) ([]*commonpb.Payload, error) {
	decoded := make([]*commonpb.Payload, len(payloads))
	for i, payload := range payloads {
		if string(payload.Metadata["encoding"]) != encryptedFormat {
			decoded[i] = payload
			continue
		}
		if keyID := string(payload.Metadata["encryption-key-id"]); keyID != encryptionKeyID {
			return nil, fmt.Errorf("unrecognized key ID %q", keyID)
		}
		if len(payload.Data) < nonceSize {
			return nil, fmt.Errorf("encrypted payload is too short")
		}
		plain, err := c.aead.Open(nil, payload.Data[:nonceSize], payload.Data[nonceSize:], nil)
		if err != nil {
			return nil, err
		}
		decoded[i] = &commonpb.Payload{}
		if err := proto.Unmarshal(plain, decoded[i]); err != nil {
			return nil, err
		}
	}
	return decoded, nil
}
