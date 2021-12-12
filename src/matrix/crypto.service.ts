import { Injectable } from '@nestjs/common';
import { Crypto } from '@peculiar/webcrypto';

@Injectable()
export class CryptoService {
  private crypto = new Crypto();

  /**
   * Encrypt an attachment.
   * @param {ArrayBuffer} plaintextBuffer The attachment data buffer.
   * @return {Promise} A promise that resolves with an object when the attachment is encrypted.
   *      The object has a "data" key with an ArrayBuffer of encrypted data and an "info" key
   *      with an object containing the info needed to decrypt the data.
   */
  public async encryptAttachment(plaintextBuffer: Buffer) {
    const ivArray = new Uint8Array(16);
    this.crypto.getRandomValues(ivArray.subarray(0, 8));

    const cryptoKey = await this.crypto.subtle.generateKey(
      { name: 'AES-CTR', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );

    const exportedKey = await this.crypto.subtle.exportKey('jwk', cryptoKey);
    const ciphertextBuffer = await this.crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: ivArray, length: 64 },
      cryptoKey,
      plaintextBuffer,
    );

    const sha256 = await this.crypto.subtle.digest('SHA-256', ciphertextBuffer);

    return {
      data: ciphertextBuffer,
      info: {
        v: 'v2',
        key: exportedKey,
        iv: this.encodeBase64(ivArray),
        hashes: {
          sha256: this.encodeBase64(new Uint8Array(sha256)),
        },
      },
    };
  }

  /**
   * Encode a typed array of uint8 as base64.
   * @param {Uint8Array} uint8Array The data to encode.
   * @return {string} The base64 without padding.
   */
  private encodeBase64(uint8Array: Uint8Array) {
    // Misinterpt the Uint8Array as Latin-1.
    // window.btoa expects a unicode string with codepoints in the range 0-255.
    const latin1String = String.fromCharCode.apply(
      null,
      uint8Array as unknown as number[],
    );
    // Use the builtin base64 encoder.
    const paddedBase64 = btoa(latin1String);
    // Calculate the unpadded length.
    const inputLength = uint8Array.length;
    const outputLength =
      4 * Math.floor((inputLength + 2) / 3) + ((inputLength + 2) % 3) - 2;
    // Return the unpadded base64.
    return paddedBase64.slice(0, outputLength);
  }
}

    // const ivArray = crypto.randomBytes(16);

    // const cryptoKey = await new Promise<crypto.KeyObject>((resolve, reject) => {
    //   crypto.generateKey('aes', { length: 256 }, (err, res) => {
    //     if (err) {
    //       reject(err);
    //     }
    //     resolve(res);
    //   });
    // });

    // const cipher = crypto.createCipheriv('aes-256-ctr', cryptoKey, ivArray);
    // const ciphertextBuffer = Buffer.concat([
    //   cipher.update(plaintextBuffer),
    //   cipher.final(),
    // ]);
    // const exportedKey = cryptoKey.export({ format: 'jwk' });

    // const sha256 = crypto
    //   .createHash('sha256')
    //   .update(ciphertextBuffer)
    //   .digest('base64');

        // v: 'v2',
        // key: {
        //   alg: 'A256CTR',
        //   ext: true,
        //   key_ops: ['encrypt', 'decrypt'],
        //   kty: 'oct',
        //   ...exportedKey,
        // },
        // iv: Buffer.from(ivArray).toString('base64'),
        // hashes: {
        //   sha256,
        // },
