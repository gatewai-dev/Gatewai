// s3-utils.ts
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
});

export async function uploadToS3(
	buffer: Buffer,
	key: string,
	contentType: string,
	bucket: string,
): Promise<void> {
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: buffer,
		ContentType: contentType,
	});
	await s3Client.send(command);
}

export async function deleteFromS3(key: string, bucket: string): Promise<void> {
	const command = new DeleteObjectCommand({
		Bucket: bucket,
		Key: key,
	});
	await s3Client.send(command);
}

export async function generateSignedUrl(
	key: string,
	bucket: string,
	expiresIn: number = 3600,
): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});
	return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function getFromS3(key: string, bucket: string): Promise<Buffer> {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});
	const response = await s3Client.send(command);
	if (!response.Body) {
		throw new Error("No body in S3 response");
	}
	const chunks: Uint8Array[] = [];
	const stream = response.Body as NodeJS.ReadableStream;
	for await (const chunk of stream) {
		chunks.push(chunk as Uint8Array);
	}
	return Buffer.concat(chunks);
}
