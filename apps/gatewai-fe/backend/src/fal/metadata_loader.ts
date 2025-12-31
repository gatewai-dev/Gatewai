

async function loadFalAIModelMetadata(urlOrId: string) {
    const response = await fetch(urlOrId)
    const data = await response.json();
    console.log({data});
    return data;
}