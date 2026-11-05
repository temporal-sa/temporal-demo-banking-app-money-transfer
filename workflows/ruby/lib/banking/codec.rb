# frozen_string_literal: true

require 'openssl'
require 'temporalio/api'
require 'temporalio/converters/payload_codec'

module Banking
  # Encrypts each whole payload with AES-GCM before it reaches Temporal.
  class EncryptionCodec < Temporalio::Converters::PayloadCodec
    # Demo-only key, shared with the codec server. In production, use a key
    # management system.
    KEY = 'banking-demo-encryption-key-32b!'
    KEY_ID = 'banking-demo-key'
    ENCODING = 'binary/encrypted'
    NONCE_BYTES = 12
    TAG_BYTES = 16

    Payload = Temporalio::Api::Common::V1::Payload

    def self.enabled?
      %w[1 true yes on].include?(ENV.fetch('BANKING_ENCRYPT', '').downcase)
    end

    def encode(payloads)
      payloads.map do |payload|
        Payload.new(
          metadata: { 'encoding' => ENCODING, 'encryption-key-id' => KEY_ID },
          data: encrypt(Payload.encode(payload))
        )
      end
    end

    # The API doesn't use the codec, so Workflow input arrives in plain JSON and
    # passes straight through.
    def decode(payloads)
      payloads.map do |payload|
        next payload unless payload.metadata['encoding'] == ENCODING

        key_id = payload.metadata['encryption-key-id']
        raise "Unrecognized key ID #{key_id}" unless key_id == KEY_ID

        Payload.decode(decrypt(payload.data))
      end
    end

    private

    def encrypt(plain)
      cipher = OpenSSL::Cipher.new('aes-256-gcm').encrypt
      cipher.key = KEY
      nonce = cipher.random_iv
      body = cipher.update(plain) + cipher.final
      nonce + body + cipher.auth_tag
    end

    def decrypt(data)
      cipher = OpenSSL::Cipher.new('aes-256-gcm').decrypt
      cipher.key = KEY
      cipher.iv = data.byteslice(0, NONCE_BYTES)
      cipher.auth_tag = data.byteslice(-TAG_BYTES, TAG_BYTES)
      cipher.update(data.byteslice(NONCE_BYTES, data.bytesize - NONCE_BYTES - TAG_BYTES)) + cipher.final
    end
  end
end
