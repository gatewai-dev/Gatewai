import type { DataType } from "@gatewai/db";

function GetDataTypeFromMimetype(mimeType: string): DataType {
    if (mimeType.startsWith('audio/')) {
        return 'Audio';
    } else if (mimeType.startsWith('video/')) {
        return 'Video';
    } else if (mimeType.startsWith('image/')) {
        return 'Image';
    } else {
        return 'File';
    }
}
export { GetDataTypeFromMimetype }
