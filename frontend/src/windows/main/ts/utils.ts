import { filesystem, os } from '@neutralinojs/lib';

export async function curlGet(url: string): Promise<any> {
	const cmd = `curl -X GET -H "Content-Type: application/json" "${url}"`;
	const content = (await os.execCommand(cmd)).stdOut.trim();
	const res = JSON.parse(content);
	return res;
}

export async function curlDownload(url: string): Promise<ArrayBuffer> {
	const cmd = `curl -X GET -L --raw "${url}"`;
	const result = await os.execCommand(cmd);
	const bytes = new Uint8Array(result.stdOut.split('').map((char) => char.charCodeAt(0)));
	return bytes.buffer;
}

export function sleep(ms = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pathExists(path: string): Promise<boolean> {
	try {
		await filesystem.getStats(path);
		return true;
	} catch (error: any) {
		if (error.code !== 'NE_FS_NOPATHE') {
			throw error;
		}
		return false;
	}
}

/**
 * Fetches an image from a given URL and converts it to a base64-encoded data URL.
 *
 * @param imageUrl - The URL of the image to fetch.
 * @returns A promise that resolves with the base64-encoded data string of the image.
 */
export async function getBase64FromImageUrl(imageUrl: string): Promise<string> {
	const response = await fetch(imageUrl);
	const blob = await response.blob();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Fetches an image from a given URL and converts it to an ArrayBuffer.
 *
 * @param imageUrl - The URL of the image to fetch.
 * @returns A promise that resolves with the ArrayBuffer of the image data.
 */
export async function getArrayBufferFromImageUrl(imageUrl: string): Promise<ArrayBuffer> {
	// Fetch the image from the provided URL
	const response = await fetch(imageUrl);

	// Check if the fetch was successful
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	}

	// Convert the response to an ArrayBuffer and return it
	return response.arrayBuffer();
}
