import { Middleware } from '@reduxjs/toolkit';
import { Logger } from 'edumeet-common';
import { countdownTimerActions } from '../slices/countdownTimerSlice';
import { signalingActions } from '../slices/signalingSlice';
import { AppDispatch, MiddlewareOptions } from '../store';

const logger = new Logger('ChatMiddleware');

const createCountdownTimerMiddleware = ({
	signalingService
}: MiddlewareOptions): Middleware => {
	logger.debug('createChatMiddleware()');

	const middleware: Middleware = ({
		dispatch
	}: {
		dispatch: AppDispatch,
	}) =>
		(next) => (action) => {
			if (signalingActions.connect.match(action)) {
				signalingService.on('notification', (notification) => {
					try {
						switch (notification.method) {
							case 'moderator:toggleCountdownTimer': {
								const { isEnabled } = notification.data;
 
								dispatch(countdownTimerActions.toggleCountdownTimer(isEnabled));

								// store.dispatch(requestActions.notify(
								// 	{
								// 		type : 'info',
								// 		text : intl.formatMessage({
								// 			id             : 'xxx',
								// 			defaultMessage : 'Countdown timer is updated'
								// 		})
								// 	}));

								break;
							}

							case 'moderator:setCountdownTimer': {

								const arr = [
									'00:00:00'
								];
		
								const { left, isRunning } = notification.data;
		
								dispatch(countdownTimerActions.setCountdownTimer(
									{ left, isRunning }));
		
								// if (arr.includes(left) && isRunning) {
								// if (left == arr[0] && isRunning) {
								// 	dispatch(countdownTimerActions.notify(
								// 		{
								// 			type: 'info',
								// 			text: intl.formatMessage({
								// 				id: 'xxx',
								// 				defaultMessage: 'Time is up'
								// 			})
								// 		}));
		
								// 	this._soundNotification('countdownTimer');
								// }

								break;
							}
						}
					} catch (error) {
						logger.error('error on signalService "notification" event [error:%o]', error);
					}
				});
			}

			return next(action);
		};
	
	return middleware;
};

export default createCountdownTimerMiddleware;