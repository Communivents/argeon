import { filesystem, events, os } from '@neutralinojs/lib';
import type { InstallationType, InstanceData, File } from '$lib/components/app/instances/types';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { API_URL } from './api';
import { curlGet, getArrayBufferFromImageUrl, getBase64FromImageUrl, pathExists } from '../utils';
import CommuniventsIcon from '@/assets/communivents.png';

// Types and Interfaces
/** Structure of a progress event during instance creation */
interface ProgressEvent {
	type: 'download';
	filename: string;
	current: number;
	total: number;
	percentage: number;
}

/** Structure of Minecraft launcher profiles */
interface LauncherProfiles {
	profiles: Record<string, LauncherProfile>;
	settings: Record<string, any>;
	version: number;
}

/** Structure of a single launcher profile */
interface LauncherProfile {
	created: string;
	icon?: string;
	lastUsed: string;
	lastVersionId: string;
	name: string;
	gameDir?: string;
	resolution?: {
		width: number;
		height: number;
	};
	type: 'custom' | 'latest-release' | 'latest-snapshot';
}

/** Structure of a library in the version JSON */
interface Library {
	name: string;
	url: string;
}

// Path Utilities
/**
 * Gets the base path for the current operating system
 * @returns Promise with the base path string
 * @throws Error if OS is not supported
 */
async function getBasePath(): Promise<string> {
	const homeDir = await os.getEnv('HOME');
	switch (window.NL_OS as unknown as string) {
		case 'Windows':
			return os.getEnv('APPDATA');
		case 'Darwin':
			return path.join(homeDir, 'Library', 'Application Support');
		case 'Linux':
			return homeDir;
		default:
			throw new Error('Unsupported operating system');
	}
}

/**
 * Gets the Minecraft path for the current operating system
 * @param basePath The base path for the current OS
 * @returns The complete Minecraft path
 */
function getMinecraftPath(basePath: string): string {
	switch (window.NL_OS as unknown as string) {
		case 'Windows':
		case 'Linux':
			return path.join(basePath, '.minecraft');
		case 'Darwin':
			return path.join(basePath, 'minecraft');
		default:
			throw new Error('Unsupported operating system');
	}
}

/**
 * Gets the PrismLauncher path for the current operating system
 * @param basePath The base path for the current OS
 * @returns The complete PrismLauncher path
 */
function getPrismLauncherPath(basePath: string): string {
	switch (window.NL_OS as unknown as string) {
		case 'Windows':
		case 'Darwin':
			return path.join(basePath, 'PrismLauncher');
		case 'Linux':
			return path.join(basePath, '.local', 'share', 'PrismLauncher');
		default:
			throw new Error('Unsupported operating system');
	}
}

// File Management
/**
 * Downloads a file with retry mechanism
 * @param cmd Curl command to execute
 * @param fullPath Full path where file should be saved
 * @param filename Name of the file being downloaded
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise<boolean> indicating success or failure
 */
async function downloadWithRetry(cmd: string, fullPath: string, filename: string, maxRetries = 3): Promise<boolean> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const result = await os.execCommand(cmd);
			if (result.exitCode !== 0) throw new Error(result.stdErr);

			const stats = await filesystem.getStats(fullPath);
			if (!stats.isFile || stats.size === 0) {
				throw new Error('Downloaded file is empty or missing');
			}

			return true;
		} catch (error) {
			console.error(`Attempt ${attempt} failed for ${filename}:`, error);

			if (attempt === maxRetries) {
				toast.error(`Failed to download ${filename}`);
				console.error('Command:', cmd);
				return false;
			}

			await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
		}
	}
	return false;
}

/**
 * Downloads multiple files to a specified directory
 * @param files Array of files to download
 * @param targetPath Path where files should be downloaded
 * @param currentFileCount Current number of files downloaded
 * @param totalFiles Total number of files to download
 */
async function downloadFiles(files: File[], targetPath: string, currentFileCount: number, totalFiles: number): Promise<void> {
	const failedDownloads: string[] = [];

	for (const file of files) {
		if (file.filename.startsWith('.index/')) {
			currentFileCount++;
			continue;
		}

		const fullPath = path.join(targetPath, file.filename);
		const dirPath = path.dirname(fullPath);

		if (!(await pathExists(dirPath))) {
			await filesystem.createDirectory(dirPath);
		}

		const progressEvent: ProgressEvent = {
			type: 'download',
			filename: file.filename,
			current: currentFileCount + 1,
			total: totalFiles,
			percentage: Math.round(((currentFileCount + 1) / totalFiles) * 100),
		};
		events.dispatch('instanceCreationProgress', progressEvent);

		const cmd = `curl -X GET -L --fail --silent --show-error -H "Accept: application/octet-stream" -o "${fullPath}" "${API_URL}${encodeURI(file.download_url)}"`;
		console.info(`Downloading: ${file.filename}`);

		const success = await downloadWithRetry(cmd, fullPath, file.filename);
		if (!success) failedDownloads.push(file.filename);
		currentFileCount++;
	}

	if (failedDownloads.length > 0) {
		const message = failedDownloads.length === 1 ? `Failed to download: ${failedDownloads[0]}` : `Failed to download ${failedDownloads.length} files. Check the console for details.`;

		toast.error(message, {
			description: 'Some files might be missing from the installation',
		});
		console.error('Failed downloads:', failedDownloads);
	}
}

// Instance Configuration
/**
 * Generates PrismLauncher configuration string
 * @param config Configuration object
 * @returns Formatted configuration string
 */
function generatePrismConfig(config: Record<string, any>): string {
	return Object.entries(config)
		.map(([key, value]) => {
			if (typeof value === 'object') {
				return `${key}=${JSON.stringify(value)}`;
			}
			return `${key}=${value}`;
		})
		.join('\n');
}

/**
 * Creates version JSON for Minecraft instance
 * @param instance Instance data
 * @returns Version JSON object
 */
async function createVersionJson(instance: InstanceData): Promise<any> {
	const libraries: Library[] = [];

	if (instance.loader.type === 'fabric') {
		const meta = await curlGet(`https://meta.fabricmc.net/v2/versions/loader/${instance.minecraft_version}/${instance.loader.version}`);
		libraries.push({ name: meta.intermediary.maven, url: 'https://maven.fabricmc.net/' }, { name: meta.loader.maven, url: 'https://maven.fabricmc.net/' });
		for (const lib of meta.launcherMeta.libraries.common) {
			libraries.push({ name: lib.name, url: lib.url });
		}
	}

	return {
		id: instance.name,
		inheritsFrom: instance.minecraft_version,
		type: 'release',
		mainClass: instance.loader.type === 'vanilla' ? 'net.minecraft.client.main.Main' : 'net.fabricmc.loader.impl.launch.knot.KnotClient',
		arguments: {
			game: ['--gameDir', path.join(instance.name, '.minecraft')],
			jvm: instance.loader.type === 'vanilla' ? [] : ['-DFabricMcEmu= net.minecraft.client.main.Main'],
		},
		libraries,
	};
}

/**
 * Updates or creates a profile in the Minecraft launcher profiles
 * @param minecraftPath Path to .minecraft directory
 * @param instance Data of the instance
 * @param instancePath Full path to instance directory
 */
async function updateLauncherProfiles(minecraftPath: string, instance: InstanceData, instancePath: string): Promise<void> {
	const profilesPath = path.join(minecraftPath, 'launcher_profiles.json');
	let profiles: LauncherProfiles;

	try {
		profiles = (await pathExists(profilesPath)) ? JSON.parse(await filesystem.readFile(profilesPath)) : { profiles: {}, settings: {}, version: 3 };

		const profileId = `communivents_${instance.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
		profiles.profiles[profileId] = {
			created: new Date().toISOString(),
			icon: await getBase64FromImageUrl(CommuniventsIcon),
			name: instance.name,
			lastUsed: new Date().toISOString(),
			lastVersionId: instance.name,
			gameDir: path.join(instancePath, '.minecraft'),
			type: 'custom',
		};

		await filesystem.writeFile(profilesPath, JSON.stringify(profiles, null, 2));

		const versionFolderPath = path.join(minecraftPath, 'versions', instance.name);
		if (await pathExists(versionFolderPath)) return;

		await filesystem.createDirectory(versionFolderPath);
		const versionJson = await createVersionJson(instance);
		await filesystem.writeFile(path.join(versionFolderPath, `${instance.name}.json`), JSON.stringify(versionJson));
	} catch (error) {
		console.error('Failed to update launcher profiles:', error);
		toast.error('Failed to update Minecraft launcher profiles');
		throw error;
	}
}

/**
 * Gets the PrismLauncher instance path
 * @param instance Instance data
 * @returns Promise with the complete instance path
 */
async function getPrismLauncherInstancePath(instance: InstanceData): Promise<string> {
	const basePath = await getBasePath();
	const prismPath = getPrismLauncherPath(basePath);
	return path.join(prismPath, 'instances', instance.name);
}

/**
 * Creates a new Minecraft instance
 * @param instanceData Data for the instance to create
 * @param installationType Type of installation (minecraft or prism)
 * @param forceInstallation Whether to force installation if instance exists
 * @returns Promise<boolean> indicating success or failure
 */
async function createMinecraftInstance(instanceData: InstanceData, installationType: InstallationType, forceInstallation = false): Promise<boolean> {
	try {
		const basePath = await getBasePath();
		const minecraftPath = getMinecraftPath(basePath);
		const instancePath = installationType === 'minecraft' ? path.join(minecraftPath, 'instances', instanceData.name) : path.join(getPrismLauncherPath(basePath), 'instances', instanceData.name);

		// Handle existing instance
		if (await pathExists(instancePath)) {
			if (forceInstallation) {
				await filesystem.remove(instancePath);
			} else {
				console.warn(`Instance "${instanceData.name}" already exists`);
				return false;
			}
		}

		// Create directory structure
		await filesystem.createDirectory(instancePath);
		await filesystem.createDirectory(path.join(instancePath, '.minecraft'));

		// Handle installation type-specific setup
		if (installationType === 'prism') {
			await setupPrismLauncherInstance(instanceData, instancePath, basePath);
		} else {
			await updateLauncherProfiles(minecraftPath, instanceData, instancePath);
		}

		// Download instance files
		await downloadInstanceFiles(instanceData, instancePath);

		events.dispatch('instanceCreationComplete', {
			instanceName: instanceData.name,
			path: instancePath,
		});
		toast.success(`Created "${instanceData.name}" instance!`);
		return true;
	} catch (error) {
		await events.dispatch('instanceCreationError', {
			error: (error as Error).message || error,
		});
		console.error(error);
		throw error;
	}
}

/**
 * Sets up a PrismLauncher instance
 * @param instanceData Instance data
 * @param instancePath Path to instance
 * @param basePath Base path for the OS
 */
async function setupPrismLauncherInstance(instanceData: InstanceData, instancePath: string, basePath: string): Promise<void> {
	const instanceConfig = {
		ExportAuthor: 'Communivents',
		ExportName: instanceData.name,
		InstanceType: 'OneSix',
		JavaVersion: instanceData.java.minimum_version,
		MaxMemAlloc: instanceData.java.recommended_memory,
		name: instanceData.name,
		notes: instanceData.description,
		iconKey: 'communivents',
	};

	const mmcPackJson = {
		formatVersion: 1,
		components: [
			{
				important: true,
				uid: 'net.minecraft',
				version: instanceData.minecraft_version,
			},
			...(instanceData.loader.type === 'fabric'
				? [
						{
							uid: 'net.fabricmc.fabric-loader',
							version: instanceData.loader.version,
							requires: [
								{
									suggests: instanceData.java.minimum_version,
									uid: 'org.prismlauncher.java',
								},
							],
						},
				  ]
				: []),
		],
	};

	const prismPath = getPrismLauncherPath(basePath);
	await filesystem.writeFile(path.join(instancePath, 'instance.cfg'), generatePrismConfig(instanceConfig));
	await filesystem.writeFile(path.join(instancePath, 'mmc-pack.json'), JSON.stringify(mmcPackJson));

	const iconPath = path.join(prismPath, 'icons', 'communivents.png');
	if (!(await pathExists(iconPath))) {
		await filesystem.writeBinaryFile(iconPath, await getArrayBufferFromImageUrl(CommuniventsIcon));
	}
}

/**
 * Downloads all files for an instance
 * @param instanceData Instance data
 * @param instancePath Path to instance
 */
async function downloadInstanceFiles(instanceData: InstanceData, instancePath: string): Promise<void> {
	const minecraftDir = path.join(instancePath, '.minecraft');

	// Calculate total files to download
	const totalFiles = Object.values(instanceData.files)
		.flat()
		.filter((file) => !file.filename.startsWith('.index/')).length;

	let currentFileCount = 0;

	// File types to process
	const fileTypes = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'config', 'screenshots', 'logs', 'crash-reports', 'versions', 'assets', 'libraries'] as const;

	// Download each file type
	for (const fileType of fileTypes) {
		const files = instanceData.files[fileType];
		if (files?.length > 0) {
			const targetPath = path.join(minecraftDir, fileType);
			await filesystem.createDirectory(targetPath);
			await downloadFiles(files, targetPath, currentFileCount, totalFiles);
			currentFileCount += files.filter((f) => !f.filename.startsWith('.index/')).length;
		}
	}
}

/**
 * Starts the specified instance in Prism Launcher
 * @param name Name of the instance to start
 */
async function startPrismInstance(name: string): Promise<void> {
	switch (window.NL_OS as unknown as string) {
		case 'Windows':
			const exePath = path.join(await os.getEnv('LOCALAPPDATA'), 'Programs', 'PrismLauncher', 'prismlauncher.exe');
			if (!(await pathExists(exePath))) {
				toast.error('PrismLauncher is not installed!');
				return;
			}
			os.spawnProcess(`${exePath} --launch "${name}"`);
			break;
		case 'Darwin':
			const result = await os.execCommand(`mdfind "kMDItemKind == 'Application' && kMDItemFSName == 'Argeon.app'" && echo "true" || echo "false"`);
			if (!result.stdOut.includes('true')) {
				toast.error('PrismLauncher is not installed!');
				return;
			}
			await os.execCommand(`osascript -e 'tell application "Prism Launcher" to quit'`);
			os.execCommand(`open -a "Prism Launcher" --args --launch "${name}"`);
			break;
		case 'Linux':
			toast.error("Launching PrismLauncher is not supported on Linux. We're looking for contributors!");
			return;
	}
}

// Export main functions
export {
	createMinecraftInstance,
	getPrismLauncherInstancePath,
	// Export utility functions that might be useful elsewhere
	downloadWithRetry,
	generatePrismConfig,
	getBasePath,
	getMinecraftPath,
	getPrismLauncherPath,
	startPrismInstance,
};
