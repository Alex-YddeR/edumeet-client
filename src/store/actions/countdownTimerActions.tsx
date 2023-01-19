import { Logger } from 'edumeet-common';
import { countdownTimerActions } from '../slices/countdownTimerSlice';
import { AppThunk } from '../store';

const logger = new Logger('CountdownTimerActions');

/**
 * This thunk action sends a chat message.
 * 
 * @param message - Message to send.
 * @returns {AppThunk<Promise<void>>} Promise.
 */
export const toggleCountdownTimer = (isEnabled : boolean): 
AppThunk<Promise<void>> => async (
	dispatch,
	getState,
	{ signalingService }
): Promise<void> => {
	logger.debug('moderator:toggleCountdownTimer()');

	try {
		await signalingService.sendRequest('moderator:toggleCountdownTimer', { isEnabled: isEnabled });

		// const peerId = getState().me.id;

		dispatch(countdownTimerActions.toggleCountdownTimer(isEnabled));
	} catch (error) {
		logger.error('moderator:toggleCountdownTimer() [error:"%o"]', error);
	}
};

export const setCountdownTimer = (left : string): 
AppThunk<Promise<void>> => async (
	dispatch,
	getState,
	{ signalingService }
): Promise<void> => {
	logger.debug('setCountdownTimer() [left:"%s"]', left);

	try {
		await signalingService.sendRequest('moderator:setCountdownTimer', { left });

		dispatch(countdownTimerActions.setCountdownTimer({ left, isRunning: false }));
	} catch (error) {
		logger.error('setCountdownTimer() [error:"%o"]', error);
	}
};

export const startCountdownTimer = (): 
AppThunk<Promise<void>> => async (
	dispatch,
	getState,
	{ signalingService }
): Promise<void> => {
	logger.debug('startCountdownTimer)');

	try {
		await signalingService.sendRequest('moderator:startCountdownTimer');

	} catch (error) {
		logger.error('startCountdownTimer() [error:"%o"]', error);
	}
};

export const stopCountdownTimer = (): 
AppThunk<Promise<void>> => async (
	dispatch,
	getState,
	{ signalingService }
): Promise<void> => {
	logger.debug('stopCountdownTimer()');

	try {
		await signalingService.sendRequest('moderator:stopCountdownTimer');

	} catch (error) {
		logger.error('stopCountdownTimer() [error:"%o"]', error);
	}
};