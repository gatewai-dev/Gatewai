export type Image_2 = {
    /** The Cloud Storage URI of the image. ``Image`` can contain a value
     for this field or the ``image_bytes`` field but not both.
     */
    gcsUri?: string;
    /** The image bytes data. ``Image`` can contain a value for this field
     or the ``gcs_uri`` field but not both.

     * @remarks Encoded as base64 string. */
    imageBytes?: string;
    /** The MIME type of the image. */
    mimeType?: string;

    // Signed URL for direct access
    url?: string
}