import type { InstanceData } from '$lib/components/app/instances/types';
import { curlGet } from '../utils';

export const API_URL = 'http://141.94.37.234:7122';

export async function loadInstances(): Promise<InstanceData[]> {
	const url = `${API_URL}/api/instances`;
	console.info('Fetching instances fron:', url);
	const json: {status: string, instances: InstanceData[]} = await curlGet(url);
	console.info('Fetched instances:', json);
	return json.instances;
}
