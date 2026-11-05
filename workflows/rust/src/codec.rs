use std::collections::HashMap;

use aes_gcm::{
    Aes256Gcm, Key, KeyInit, Nonce,
    aead::{Aead, AeadCore, OsRng},
};
use futures::future::BoxFuture;
use prost::Message;
use temporalio_common::{
    data_converters::{PayloadCodec, PayloadConversionError, SerializationContextData},
    protos::temporal::api::common::v1::Payload,
};

// Demo-only key, shared with the codec server. In production, use a key
// management system.
const KEY: &[u8; 32] = b"banking-demo-encryption-key-32b!";
const KEY_ID: &str = "banking-demo-key";
const ENCODING: &str = "binary/encrypted";
const NONCE_BYTES: usize = 12;

/// Encrypts each whole payload with AES-GCM before it reaches Temporal.
#[derive(Clone)]
pub struct EncryptionCodec {
    cipher: Aes256Gcm,
}

impl EncryptionCodec {
    pub fn new() -> Self {
        Self {
            cipher: Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(KEY)),
        }
    }

    pub fn enabled() -> bool {
        let value = std::env::var("BANKING_ENCRYPT").unwrap_or_default().to_lowercase();
        matches!(value.as_str(), "1" | "true" | "yes" | "on")
    }

    fn encrypt(&self, payload: &Payload) -> Result<Payload, PayloadConversionError> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let body = self
            .cipher
            .encrypt(&nonce, payload.encode_to_vec().as_slice())
            .map_err(|_| failure("Unable to encrypt a payload"))?;
        Ok(Payload {
            metadata: HashMap::from([
                ("encoding".to_string(), ENCODING.as_bytes().to_vec()),
                ("encryption-key-id".to_string(), KEY_ID.as_bytes().to_vec()),
            ]),
            data: [nonce.as_slice(), body.as_slice()].concat(),
            ..Default::default()
        })
    }

    /// The API doesn't use the codec, so Workflow input arrives in plain JSON
    /// and passes straight through.
    fn decrypt(&self, payload: Payload) -> Result<Payload, PayloadConversionError> {
        if payload.metadata.get("encoding").map(Vec::as_slice) != Some(ENCODING.as_bytes()) {
            return Ok(payload);
        }
        if payload.metadata.get("encryption-key-id").map(Vec::as_slice) != Some(KEY_ID.as_bytes()) {
            return Err(failure("Unrecognized key ID"));
        }
        if payload.data.len() < NONCE_BYTES {
            return Err(failure("Encrypted payload is too short"));
        }
        let (nonce, body) = payload.data.split_at(NONCE_BYTES);
        let plain = self
            .cipher
            .decrypt(Nonce::from_slice(nonce), body)
            .map_err(|_| failure("Unable to decrypt a payload"))?;
        Payload::decode(plain.as_slice()).map_err(|_| failure("Decrypted payload is invalid"))
    }
}

fn failure(message: &str) -> PayloadConversionError {
    PayloadConversionError::EncodingError(message.to_string().into())
}

impl PayloadCodec for EncryptionCodec {
    fn encode(
        &self,
        _context: &SerializationContextData,
        payloads: Vec<Payload>,
    ) -> BoxFuture<'static, Result<Vec<Payload>, PayloadConversionError>> {
        let codec = self.clone();
        Box::pin(async move { payloads.iter().map(|payload| codec.encrypt(payload)).collect() })
    }

    fn decode(
        &self,
        _context: &SerializationContextData,
        payloads: Vec<Payload>,
    ) -> BoxFuture<'static, Result<Vec<Payload>, PayloadConversionError>> {
        let codec = self.clone();
        Box::pin(async move { payloads.into_iter().map(|payload| codec.decrypt(payload)).collect() })
    }
}
