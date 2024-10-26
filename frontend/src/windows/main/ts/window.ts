import { events, app, debug } from '@neutralinojs/lib';
import hotkeys from 'hotkeys-js';

events
	.on('windowClose', () => {
		app.exit(0).catch(console.error);
	})
	.catch(console.error)
	.then(() => {
		debug.log('Attached window closer').catch(console.error);
	});

// Shortcuts like copy, paste, quit, etc... (they are unimplemented by default in NeuJS)
hotkeys.filter = () => true;
hotkeys('ctrl+a,cmd+a', () => {
	document.execCommand('selectAll');
	return false;
});

hotkeys('ctrl+c,cmd+c', () => {
	document.execCommand('copy');
	return false;
});

hotkeys('ctrl+v,cmd+v', () => {
	document.execCommand('paste');
	return false;
});

hotkeys('ctrl+x,cmd+x', () => {
	document.execCommand('copy');
	document.execCommand('cut');
	return false;
});

hotkeys('ctrl+z,cmd+z', () => {
	document.execCommand('undo');
	return false;
});

hotkeys('ctrl+shift+z,cmd+shift+z', () => {
	document.execCommand('redo');
	return false;
});

hotkeys('cmd+q,cmd+w', () => {
	app.exit(0);
	return false;
});
