using System.Security.Cryptography;
using System.Text;
using Google.Protobuf;
using Temporalio.Api.Common.V1;
using Temporalio.Converters;

namespace Banking;

/// <summary>Encrypts each whole payload with AES-GCM before it reaches Temporal.</summary>
public class EncryptionCodec : IPayloadCodec
{
    // Demo-only key, shared with the codec server. In production, use a key
    // management system.
    private const string Key = "banking-demo-encryption-key-32b!";
    private const string KeyId = "banking-demo-key";
    private const string EncryptedFormat = "binary/encrypted";
    private const int NonceBytes = 12;
    private const int TagBytes = 16;

    private readonly AesGcm aes = new(Encoding.UTF8.GetBytes(Key), TagBytes);

    public static bool Enabled =>
        new[] { "1", "true", "yes", "on" }.Contains(
            (Environment.GetEnvironmentVariable("BANKING_ENCRYPT") ?? string.Empty).ToLowerInvariant());

    public Task<IReadOnlyCollection<Payload>> EncodeAsync(IReadOnlyCollection<Payload> payloads) =>
        Task.FromResult<IReadOnlyCollection<Payload>>(payloads.Select(payload => new Payload
        {
            Metadata =
            {
                ["encoding"] = ByteString.CopyFromUtf8(EncryptedFormat),
                ["encryption-key-id"] = ByteString.CopyFromUtf8(KeyId),
            },
            Data = ByteString.CopyFrom(Encrypt(payload.ToByteArray())),
        }).ToList());

    /// <summary>
    /// The API doesn't use the codec, so Workflow input arrives in plain JSON
    /// and passes straight through.
    /// </summary>
    public Task<IReadOnlyCollection<Payload>> DecodeAsync(IReadOnlyCollection<Payload> payloads) =>
        Task.FromResult<IReadOnlyCollection<Payload>>(payloads.Select(payload =>
        {
            if (!payload.Metadata.TryGetValue("encoding", out var encoding) || encoding.ToStringUtf8() != EncryptedFormat)
            {
                return payload;
            }
            var keyId = payload.Metadata.TryGetValue("encryption-key-id", out var id) ? id.ToStringUtf8() : string.Empty;
            if (keyId != KeyId)
            {
                throw new InvalidOperationException($"Unrecognized key ID {keyId}");
            }
            return Payload.Parser.ParseFrom(Decrypt(payload.Data.ToByteArray()));
        }).ToList());

    private byte[] Encrypt(byte[] plain)
    {
        var result = new byte[NonceBytes + plain.Length + TagBytes];
        var nonce = result.AsSpan(0, NonceBytes);
        RandomNumberGenerator.Fill(nonce);
        aes.Encrypt(nonce, plain, result.AsSpan(NonceBytes, plain.Length), result.AsSpan(NonceBytes + plain.Length));
        return result;
    }

    private byte[] Decrypt(byte[] data)
    {
        var plain = new byte[data.Length - NonceBytes - TagBytes];
        aes.Decrypt(
            data.AsSpan(0, NonceBytes),
            data.AsSpan(NonceBytes, plain.Length),
            data.AsSpan(data.Length - TagBytes),
            plain);
        return plain;
    }
}
