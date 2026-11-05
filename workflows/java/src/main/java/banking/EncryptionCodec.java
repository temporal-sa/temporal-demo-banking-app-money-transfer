package banking;

import com.google.protobuf.ByteString;
import com.google.protobuf.InvalidProtocolBufferException;
import io.temporal.api.common.v1.Payload;
import io.temporal.payload.codec.PayloadCodec;
import io.temporal.payload.codec.PayloadCodecException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Encrypts each whole payload with AES-GCM before it reaches Temporal. */
public class EncryptionCodec implements PayloadCodec {
    // Demo-only key, shared with the codec server. In production, use a key management system.
    private static final byte[] KEY = "banking-demo-encryption-key-32b!".getBytes(StandardCharsets.UTF_8);
    private static final String KEY_ID = "banking-demo-key";
    private static final String ENCODING = "binary/encrypted";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();

    public static boolean enabled() {
        String value = System.getenv().getOrDefault("BANKING_ENCRYPT", "").toLowerCase();
        return Set.of("1", "true", "yes", "on").contains(value);
    }

    @Override
    public List<Payload> encode(List<Payload> payloads) {
        List<Payload> encoded = new ArrayList<>(payloads.size());
        for (Payload payload : payloads) {
            encoded.add(Payload.newBuilder()
                    .putMetadata("encoding", ByteString.copyFromUtf8(ENCODING))
                    .putMetadata("encryption-key-id", ByteString.copyFromUtf8(KEY_ID))
                    .setData(ByteString.copyFrom(encrypt(payload.toByteArray())))
                    .build());
        }
        return encoded;
    }

    /** The API doesn't use the codec, so Workflow input arrives in plain JSON and passes straight through. */
    @Override
    public List<Payload> decode(List<Payload> payloads) {
        List<Payload> decoded = new ArrayList<>(payloads.size());
        for (Payload payload : payloads) {
            ByteString encoding = payload.getMetadataOrDefault("encoding", ByteString.EMPTY);
            if (!encoding.toStringUtf8().equals(ENCODING)) {
                decoded.add(payload);
                continue;
            }
            String keyId = payload.getMetadataOrDefault("encryption-key-id", ByteString.EMPTY).toStringUtf8();
            if (!keyId.equals(KEY_ID)) {
                throw new PayloadCodecException("Unrecognized key ID " + keyId);
            }
            try {
                decoded.add(Payload.parseFrom(decrypt(payload.getData().toByteArray())));
            } catch (InvalidProtocolBufferException e) {
                throw new PayloadCodecException(e);
            }
        }
        return decoded;
    }

    private byte[] encrypt(byte[] plain) {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        try {
            Cipher cipher = cipher(Cipher.ENCRYPT_MODE, nonce);
            byte[] body = cipher.doFinal(plain);
            byte[] result = new byte[NONCE_BYTES + body.length];
            System.arraycopy(nonce, 0, result, 0, NONCE_BYTES);
            System.arraycopy(body, 0, result, NONCE_BYTES, body.length);
            return result;
        } catch (GeneralSecurityException e) {
            throw new PayloadCodecException(e);
        }
    }

    private byte[] decrypt(byte[] data) {
        try {
            return cipher(Cipher.DECRYPT_MODE, data).doFinal(data, NONCE_BYTES, data.length - NONCE_BYTES);
        } catch (GeneralSecurityException e) {
            throw new PayloadCodecException(e);
        }
    }

    private static Cipher cipher(int mode, byte[] nonceSource) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(KEY, "AES"), new GCMParameterSpec(TAG_BITS, nonceSource, 0, NONCE_BYTES));
        return cipher;
    }
}
