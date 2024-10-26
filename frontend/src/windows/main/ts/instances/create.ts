import { filesystem, events, os } from '@neutralinojs/lib';
import type { InstallationType, InstanceData, File } from '$lib/components/app/instances/types';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { API_URL } from './api';
import { curlGet, getArrayBufferFromImageUrl, getBase64FromImageUrl, pathExists } from '../utils';
import CommuniventsIcon from '@/assets/communivents.png';

/** Structure of a progress event during instance creation */
type ProgressEvent = {
	type: 'download';
	filename: string;
	current: number;
	total: number;
	percentage: number;
};

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

interface Library {
	name: string;
	url: string;
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
		// Read existing profiles or create new ones
		if (await pathExists(profilesPath)) {
			const content = await filesystem.readFile(profilesPath);
			profiles = JSON.parse(content);
		} else {
			profiles = {
				profiles: {},
				settings: {},
				version: 3,
			};
		}

		// Create unique profile ID
		const profileId = `communivents_${instance.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

		// Update or create profile
		profiles.profiles[profileId] = {
			created: new Date().toISOString(),
			icon: await getBase64FromImageUrl(CommuniventsIcon),
			name: instance.name,
			lastUsed: new Date().toISOString(),
			lastVersionId: instance.name,
			gameDir: path.join(instancePath, '.minecraft'),
			type: 'custom',
		};

		// Write updated profiles back to file
		await filesystem.writeFile(profilesPath, JSON.stringify(profiles, null, 2));

		// Create version folder if it doesn't exist
		const versionFolderPath = path.join(minecraftPath, 'versions', instance.name);
		const versionFilePath = path.join(versionFolderPath, `${instance.name}.json`);
		if (await pathExists(versionFolderPath)) return;
		await filesystem.createDirectory(versionFolderPath);

		// Get libraries if on fabric
		const libraries: Library[] = [];
		if (instance.loader.type === 'fabric') {
			const meta = await curlGet(`https://meta.fabricmc.net/v2/versions/loader/${instance.minecraft_version}/${instance.loader.version}`);
			// Intermediary and Loader
			libraries.push({ name: meta.intermediary.maven, url: 'https://maven.fabricmc.net/' }, { name: meta.loader.maven, url: 'https://maven.fabricmc.net/' });
			for (const lib of meta.launcherMeta.libraries.common) {
				libraries.push({ name: lib.name, url: lib.url });
			}
		}

		const versionJson = {
			id: instance.name,
			inheritsFrom: instance.minecraft_version,
			type: 'release',
			mainClass: instance.loader.type === 'vanilla' ? 'net.minecraft.client.main.Main' : 'net.fabricmc.loader.impl.launch.knot.KnotClient',
			arguments: {
				game: ['--gameDir', path.join(instancePath, '.minecraft')],
				jvm: instance.loader.type === 'vanilla' ? [] : ['-DFabricMcEmu= net.minecraft.client.main.Main'],
			},
			libraries,
		};
		console.info(versionJson);
		await filesystem.writeFile(versionFilePath, JSON.stringify(versionJson));
	} catch (error) {
		console.error('Failed to update launcher profiles:', error);
		toast.error('Failed to update Minecraft launcher profiles');
		throw error;
	}
}

/**
 * Downloads a file with retry mechanism
 * @param cmd Curl command to execute
 * @param fullPath Full path where file should be saved
 * @param filename Name of the file being downloaded
 * @param maxRetries Maximum number of retry attempts
 * @returns boolean indicating success or failure
 */
async function downloadWithRetry(cmd: string, fullPath: string, filename: string, maxRetries = 3): Promise<boolean> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const result = await os.execCommand(cmd);
			if (result.exitCode !== 0) {
				throw new Error(result.stdErr);
			}

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

		events.dispatch('instanceCreationProgress', {
			type: 'download',
			filename: file.filename,
			current: currentFileCount + 1,
			total: totalFiles,
			percentage: Math.round(((currentFileCount + 1) / totalFiles) * 100),
		} as ProgressEvent);

		const cmd = `curl -X GET -L --fail --silent --show-error -H "Accept: application/octet-stream" -o "${fullPath}" "${API_URL}${encodeURI(file.download_url)}"`;
		console.info(`Downloading: ${file.filename}`);

		const success = await downloadWithRetry(cmd, fullPath, file.filename);
		if (!success) {
			failedDownloads.push(file.filename);
		}
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

/**
 * Downloads Minecraft client files
 * @param urls URLs for client files
 * @param minecraftPath Path to .minecraft directory
 */
async function downloadMinecraftFiles(urls: InstanceData['download_urls'], minecraftPath: string): Promise<void> {
	const clientPath = path.join(minecraftPath, 'client.jar');
	const cmd = `curl -X GET -L -o "${clientPath}" "${urls.client_jar}"`;
	await os.execCommand(cmd);
}

/**
 * Generates PrismLauncher configuration string
 * @param config Configuration object
 * @returns Formatted configuration string
 */
function generatePrismConfig(config: any): string {
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
 * Creates a new Minecraft instance
 * @param instanceData Data for the instance to create
 * @param installationType Type of installation (minecraft or prism)
 * @param forceInstallation Whether to force installation if instance exists
 * @returns Promise<boolean> indicating success or failure
 */
async function createMinecraftInstance(instanceData: InstanceData, installationType: InstallationType, forceInstallation = false): Promise<boolean> {
	try {
		// Get OS-specific paths
		const homeDir = await os.getEnv('HOME');
		let minecraftPath: string;
		let instancePath: string;

		// First determine the base path without minecraft/prismlauncher
		let basePath: string;
		switch (window.NL_OS as unknown as string) {
			case 'Windows':
				basePath = await os.getEnv('APPDATA');
				break;
			case 'Darwin':
				basePath = path.join(homeDir, 'Library', 'Application Support');
				break;
			case 'Linux':
				basePath = homeDir;
				break;
			default:
				throw new Error('Unsupported operating system');
		}

		console.info('Base path:', basePath);

		// Then set up minecraft path
		switch (window.NL_OS as unknown as string) {
			case 'Windows':
				minecraftPath = path.join(basePath, '.minecraft');
				break;
			case 'Darwin':
				minecraftPath = path.join(basePath, 'minecraft');
				break;
			case 'Linux':
				minecraftPath = path.join(basePath, '.minecraft');
				break;
			default:
				throw new Error('Unsupported operating system');
		}
		console.info('Minecraft path:', minecraftPath);

		// Set up paths based on installation type
		let prismPath = '';
		if (installationType === 'minecraft') {
			instancePath = path.join(minecraftPath, 'instances', instanceData.name);
		} else {
			// PrismLauncher paths per OS
			switch (window.NL_OS as unknown as string) {
				case 'Windows':
					prismPath = path.join(basePath, 'PrismLauncher');
					break;
				case 'Darwin':
					prismPath = path.join(basePath, 'PrismLauncher');
					break;
				case 'Linux':
					prismPath = path.join(basePath, '.local', 'share', 'PrismLauncher');
					break;
				default:
					throw new Error('Unsupported operating system');
			}
			instancePath = path.join(prismPath, 'instances', instanceData.name);
			console.info('Instance path:', instancePath);
		}

		// Check if instance already exists
		const dirExists = await pathExists(instancePath);
		if (dirExists) {
			if (forceInstallation) {
				await filesystem.remove(instancePath);
			} else {
				console.warn(`Instance "${instanceData.name}" already exists`);
				return false;
			}
		}

		// Create instance directory structure
		if (!(await pathExists(instancePath))) {
			await filesystem.createDirectory(instancePath);
		}
		if (!(await pathExists(path.join(instancePath, '.minecraft')))) {
			await filesystem.createDirectory(path.join(instancePath, '.minecraft'));
		}

		// Create instance configuration
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

		// Create version cache (mmc-pack.json)
		const mmcPackJson: any = {
			formatVersion: 1,
			components: [
				{
					important: true,
					uid: 'net.minecraft',
					version: instanceData.minecraft_version,
				},
			],
		};

		if (instanceData.loader.type === 'fabric') {
			mmcPackJson.components.push({
				uid: 'net.fabricmc.fabric-loader',
				version: instanceData.loader.version,
				requires: [
					{
						suggests: instanceData.java.minimum_version,
						uid: 'org.prismlauncher.java',
					},
				],
			});
		}

		// Write instance configuration
		if (installationType === 'prism') {
			await filesystem.writeFile(path.join(instancePath, 'instance.cfg'), generatePrismConfig(instanceConfig));
			await filesystem.writeFile(path.join(instancePath, 'mmc-pack.json'), JSON.stringify(mmcPackJson));
			const iconPath = path.join(prismPath, 'icons', 'communivents.png');
			if (!(await pathExists(iconPath))) {
				await filesystem.writeBinaryFile(iconPath, await getArrayBufferFromImageUrl(CommuniventsIcon));
			}
		} else {
			// Update Minecraft launcher profiles
			await updateLauncherProfiles(minecraftPath, instanceData, instancePath);
		}

		// Calculate total files to download
		const totalFiles = Object.values(instanceData.files)
			.flat()
			.filter((file) => !file.filename.startsWith('.index/')).length;

		let currentFileCount = 0;

		// Download all file types to .minecraft directory
		const minecraftDir = path.join(instancePath, '.minecraft');
		console.info('Minecraft directory:', minecraftDir);

		// All file types to process
		const fileTypes = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'config', 'screenshots', 'logs', 'crash-reports', 'versions', 'assets', 'libraries'] as const;

		// Download each file type
		for (const fileType of fileTypes) {
			if (instanceData.files[fileType]?.length > 0) {
				const targetPath = path.join(minecraftDir, fileType);
				if (!(await pathExists(targetPath))) {
					await filesystem.createDirectory(targetPath);
				}
				await downloadFiles(instanceData.files[fileType], targetPath, currentFileCount, totalFiles);
				currentFileCount += instanceData.files[fileType].filter((f) => !f.filename.startsWith('.index/')).length;
			}
		}

		// Download Minecraft client for vanilla instances
		if (instanceData.loader.type === 'vanilla') {
			await downloadMinecraftFiles(instanceData.download_urls, minecraftDir);
		}

		events.dispatch('instanceCreationComplete', {
			instanceName: instanceData.name,
			path: instancePath,
		});
		toast.success(`Created "${instanceData.name}" instance!`);
		return true;
	} catch (error) {
		events
			.dispatch('instanceCreationError', {
				error: (error as any).message || error,
			})
			.catch(console.error);
		console.error(error);
		throw error;
	}
}

export { createMinecraftInstance };
