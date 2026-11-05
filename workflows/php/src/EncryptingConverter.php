<?php

declare(strict_types=1);

use Temporal\Api\Common\V1\Payload;
use Temporal\DataConverter\DataConverterInterface;
use Temporal\DataConverter\PayloadConverterInterface;
use Temporal\DataConverter\Type;

/**
 * Encrypts each whole payload with AES-GCM before it reaches Temporal. The PHP
 * SDK has no payload codec, so this wraps the default converter instead, in the
 * same format the codec server decrypts.
 */
final class EncryptingConverter implements PayloadConverterInterface
{
    // Demo-only key, shared with the codec server. In production, use a key
    // management system.
    private const KEY = 'banking-demo-encryption-key-32b!';
    private const KEY_ID = 'banking-demo-key';
    private const ENCODING = 'binary/encrypted';
    private const CIPHER = 'aes-256-gcm';
    private const NONCE_BYTES = 12;
    private const TAG_BYTES = 16;

    public function __construct(private readonly DataConverterInterface $inner) {}

    public static function enabled(): bool
    {
        return in_array(strtolower(getenv('BANKING_ENCRYPT') ?: ''), ['1', 'true', 'yes', 'on'], true);
    }

    public function getEncodingType(): string
    {
        return self::ENCODING;
    }

    public function toPayload($value): ?Payload
    {
        $plain = $this->inner->toPayload($value)->serializeToString();
        $nonce = random_bytes(self::NONCE_BYTES);
        $tag = '';
        $body = openssl_encrypt($plain, self::CIPHER, self::KEY, OPENSSL_RAW_DATA, $nonce, $tag, '', self::TAG_BYTES);

        $payload = new Payload();
        $payload->setMetadata(['encoding' => self::ENCODING, 'encryption-key-id' => self::KEY_ID]);
        $payload->setData($nonce . $body . $tag);
        return $payload;
    }

    public function fromPayload(Payload $payload, Type $type)
    {
        $keyId = $payload->getMetadata()['encryption-key-id'] ?? '';
        if ($keyId !== self::KEY_ID) {
            throw new \RuntimeException("Unrecognized key ID {$keyId}");
        }

        $data = $payload->getData();
        $nonce = substr($data, 0, self::NONCE_BYTES);
        $body = substr($data, self::NONCE_BYTES, -self::TAG_BYTES);
        $tag = substr($data, -self::TAG_BYTES);
        $plain = openssl_decrypt($body, self::CIPHER, self::KEY, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($plain === false) {
            throw new \RuntimeException('Unable to decrypt a payload');
        }

        $decoded = new Payload();
        $decoded->mergeFromString($plain);
        return $this->inner->fromPayload($decoded, $type);
    }
}
