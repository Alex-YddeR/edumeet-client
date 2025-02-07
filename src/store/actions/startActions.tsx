import { AppThunk } from '../store';
import { meActions } from '../slices/meSlice';
import { DevicesUpdated } from '../../services/deviceService';
import {
	makePermissionSelector,
	micProducerSelector,
	webcamProducerSelector
} from '../selectors';
import { permissions } from '../../utils/roles';
import { updateMic, updateWebcam } from './mediaActions';
import { producersActions } from '../slices/producersSlice';
import { uiActions } from '../slices/uiSlice';
import { lock, unlock } from './permissionsActions';
import { permissionsActions } from '../slices/permissionsSlice';
import { Logger } from 'edumeet-common';
import { setRaisedHand } from './meActions';

const logger = new Logger('listenerActions');

// eslint-disable-next-line no-unused-vars
let keydownListener: (event: KeyboardEvent) => void;
// eslint-disable-next-line no-unused-vars
let keyupListener: (event: KeyboardEvent) => void;
// eslint-disable-next-line no-unused-vars
let messageListener: (event: MessageEvent) => void;
let deviceChangeListener: () => Promise<void>;
// eslint-disable-next-line no-unused-vars
let devicesUpdatedListener: (event: DevicesUpdated) => void;

export const startListeners = (): AppThunk<Promise<void>> => async (
	dispatch,
	getState,
	{ signalingService, deviceService, managementService }
): Promise<void> => {
	logger.debug('startListeners()');

	devicesUpdatedListener = ({
		devices,
		removedDevices,
		newDevices
	}: DevicesUpdated) => {
		logger.debug(
			'mediaDevicesUpdated() [devices:%o, removedDevices:%o, newDevices:%o]',
			devices,
			removedDevices,
			newDevices
		);

		// TODO: notify about removed or new devices

		dispatch(meActions.setDevices(devices));

		/* if (newDevices.length || removedDevices.length) {
			dispatch(notificationsActions.enqueueNotification({
				message: devicesChangedLabel()
			}));
		} */
	};

	deviceService.on('devicesUpdated', devicesUpdatedListener);

	deviceChangeListener = async () => {
		logger.debug('devicechange');

		await deviceService.updateMediaDevices();
	};

	navigator.mediaDevices.addEventListener('devicechange', deviceChangeListener);

	const audioPermissionSelector = makePermissionSelector(permissions.SHARE_AUDIO);
	const videoPermissionSelector = makePermissionSelector(permissions.SHARE_VIDEO);
	const lockPermissionSelector = makePermissionSelector(permissions.LOCK_ROOM);

	keydownListener = ({ repeat, target, key }): void => {
		if (repeat) return;

		const source = target as HTMLElement;

		if (
			[ 'input', 'textarea', 'div' ]
				.includes(source?.tagName?.toLowerCase())
		)
			return;

		logger.debug('[keydown:%s]', key);

		switch (key) {
			case 'm': {
				const audioInProgress = getState().me.audioInProgress;

				if (audioInProgress) return;

				const hasAudioPermission = audioPermissionSelector(getState());
				const canSendMic = getState().me.canSendMic;

				if (!hasAudioPermission || !canSendMic) return;

				const micProducer = micProducerSelector(getState());

				if (!micProducer) {
					dispatch(updateMic({
						start: true
					}));
				} else if (!micProducer.paused) {
					dispatch(
						producersActions.setProducerPaused({
							producerId: micProducer.id,
							local: true,
							source: 'mic'
						})
					);
				} else {
					dispatch(
						producersActions.setProducerResumed({
							producerId: micProducer.id,
							local: true,
							source: 'mic'
						})
					);
				}

				break;
			}

			case 'v': {
				const videoInProgress = getState().me.videoInProgress;

				if (videoInProgress) return;

				const hasVideoPermission = videoPermissionSelector(getState());
				const canSendWebcam = getState().me.canSendWebcam;

				if (!hasVideoPermission || !canSendWebcam) return;

				const webcamProducer = webcamProducerSelector(getState());

				if (!webcamProducer) {
					dispatch(updateWebcam({
						start: true
					}));
				} else {
					dispatch(
						producersActions.closeProducer({
							producerId: webcamProducer.id,
							local: true,
							source: 'webcam'
						})
					);
				}

				break;
			}

			case 's': {
				const settingsOpen = getState().ui.settingsOpen;

				dispatch(uiActions.setUi({ settingsOpen: !settingsOpen }));

				break;
			}

			case 'd': {
				const filesharingOpen = getState().ui.filesharingOpen;

				dispatch(uiActions.setUi({ filesharingOpen: !filesharingOpen }));

				break;
			}

			case 'l': {
				const lockInProgress = getState().room.lockInProgress;

				if (lockInProgress) return;

				const hasLockPermission = lockPermissionSelector(getState());

				if (!hasLockPermission) return;

				const locked = getState().permissions.locked;

				locked ? dispatch(unlock()) : dispatch(lock());

				break;
			}

			case 'p': {
				const participantListOpen = getState().ui.participantListOpen;

				dispatch(uiActions.setUi({ participantListOpen: !participantListOpen }));

				break;
			}

			case 'c': {
				const chatOpen = getState().ui.chatOpen;

				dispatch(uiActions.setUi({ chatOpen: !chatOpen }));

				break;
			}

			case 'q': {
				const showStats = getState().ui.showStats;

				dispatch(uiActions.setUi({ showStats: !showStats }));
				
				break;
			}

			case 'r': {
				const raisedHandInProgress = getState().me.raisedHandInProgress;

				if (raisedHandInProgress) return;

				const raisedHand = getState().me.raisedHand;

				dispatch(setRaisedHand(!raisedHand));

				break;
			}

			case 'h': {
				const helpOpen = getState().ui.helpOpen;

				dispatch(uiActions.setUi({ helpOpen: !helpOpen }));

				break;
			}

			case ' ': {
				const audioInProgress = getState().me.audioInProgress;

				if (audioInProgress) return;

				const hasAudioPermission = audioPermissionSelector(getState());
				const canSendMic = getState().me.canSendMic;

				if (!canSendMic || !hasAudioPermission) return;

				const micProducer = micProducerSelector(getState());

				if (!micProducer) {
					dispatch(updateMic({
						start: true
					}));
				} else if (micProducer.paused) {
					dispatch(
						producersActions.setProducerResumed({
							producerId: micProducer.id,
							local: true,
							source: 'mic'
						})
					);
				}

				break;
			}

			default: {
				break;
			}
		}
	};

	document.addEventListener('keydown', keydownListener);

	keyupListener = (event): void => {
		const source = event.target as HTMLElement;

		if (
			[ 'input', 'textarea', 'div' ]
				.includes(source?.tagName?.toLowerCase())
		)
			return;

		logger.debug('[keyup:%s]', event.key);

		switch (event.key) {
			case ' ': {
				const audioInProgress = getState().me.audioInProgress;

				if (audioInProgress) return;

				const hasAudioPermission = audioPermissionSelector(getState());
				const canSendMic = getState().me.canSendMic;

				if (!canSendMic || !hasAudioPermission) return;

				const micProducer = micProducerSelector(getState());

				if (!micProducer) return;

				if (!micProducer.paused) {
					dispatch(
						producersActions.setProducerPaused({
							producerId: micProducer.id,
							local: true,
							source: 'mic'
						})
					);
				}
				break;
			}

			default: {
				break;
			}
		}

		event.preventDefault();
	};

	document.addEventListener('keyup', keyupListener);

	messageListener = async ({ data }: MessageEvent) => {
		if (data.type === 'edumeet-login') {
			const { data: token } = data;

			await managementService.authentication.setAccessToken(token);

			dispatch(permissionsActions.setToken(token));
			dispatch(permissionsActions.setLoggedIn(true));

			if (getState().signaling.state === 'connected')
				await signalingService.sendRequest('updateToken', { token }).catch((e) => logger.error('updateToken request failed [error: %o]', e));
		}
	};

	window.addEventListener('message', messageListener);
};

export const stopListeners = (): AppThunk<Promise<void>> => async (
	_dispatch,
	_getState,
	{ deviceService }
): Promise<void> => {
	logger.debug('stopListeners()');

	deviceService.removeListener('devicesUpdated', devicesUpdatedListener);
	navigator.mediaDevices.removeEventListener('devicechange', deviceChangeListener);
	document.removeEventListener('keydown', keydownListener);
	document.removeEventListener('keyup', keyupListener);
	window.removeEventListener('message', messageListener);
};