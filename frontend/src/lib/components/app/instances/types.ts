export type InstallationType = 'minecraft' | 'prism';

export interface File {
	download_url: string;
	filename: string;
	hash: string;
	size: number;
}

export type Mod = {
	filename: string;
	download_url: string;
	hash: string;
	size: number;
};

export type InstanceData = {
	name: string;
	description: string;
	minecraft_version: string;
	loader: {
		type: 'fabric' | 'vanilla';
		version: string;
		maven: string;
		metadata_url: string;
		installer_url: string;
	};
	java: {
		minimum_version: string;
		recommended_memory: string;
	};
	download_urls: {
		client_jar: string;
		assets: string;
	};
	files: {
		mods: File[];
		resourcepacks: File[];
		shaderpacks: File[];
		saves: File[];
		config: File[];
		screenshots: File[];
		logs: File[];
		'crash-reports': File[];
		versions: File[];
		assets: File[];
		libraries: File[];
	};
};
