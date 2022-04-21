/* eslint-disable no-unused-vars */
import { Logger } from '../utils/logger';
import { io, Socket } from 'socket.io-client';
import EventEmitter from 'events';
import { SocketTimeoutError } from '../utils/SocketTimeoutError';
import {
	ConnectWebRtcTransport,
	ConsumerData,
	CreateWebRtcTransport,
	JoinData,
	ProduceData,
	PauseProducerData,
	ResumeProducerData,
	SocketInboundNotification,
	SocketOutboundRequest,
	DisplayNameData
} from '../utils/types';
import edumeetConfig from '../utils/edumeetConfig';

export declare interface SignalingService {
	// Signaling events
	on(event: 'connect', listener: () => void): this;
	on(event: 'disconnect', listener: () => void): this;
	on(event: 'reconnect', listener: (attempt: number) => void): this;
	on(event: 'reconnect_failed', listener: () => void): this;

	// General server messages
	on(event: 'notification', listener: (notification: SocketInboundNotification) => void): this;
}

interface ServerClientEvents {
	notification: ({ method, data }: SocketInboundNotification) => void;
}

interface ClientServerEvents {
	request: (request: SocketOutboundRequest, result: (
		timeout: Error | null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		serverError: any | null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		responseData: any) => void
	) => void;
}

const logger = new Logger('SignalingService');

export class SignalingService extends EventEmitter {
	private socket?: Socket<ServerClientEvents, ClientServerEvents>;

	public connect({ url }: { url: string}): void {
		logger.debug('connect() [url:%s]', url);

		this.socket = io(url, {
			transports: [ 'websocket' ]
		});

		this.handleSocket();
	}

	private handleSocket(): void {
		this.socket?.on('notification', (notification) => {
			this.emit('notification', notification);
		});

		this.socket?.on('connect', () => {
			logger.debug('_handleSocket() | connected');

			this.emit('connect');
		});

		this.socket?.on('disconnect', (reason) => {
			logger.debug('_handleSocket() | disconnected [reason:%s]', reason);

			if (
				reason === 'io server disconnect' ||
				reason === 'io client disconnect'
			) {
				logger.debug('_handleSocket() | purposefully disconnected');

				this.emit('disconnect');
			} else {
				this.emit('reconnect');
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private sendRequestOnWire(socketMessage: SocketOutboundRequest): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject('No socket connection');
			} else {
				this.socket.timeout(edumeetConfig.requestTimeout).emit('request', socketMessage, (timeout, serverError, response) => {
					if (timeout) reject(new SocketTimeoutError('Request timed out'));
					else if (serverError) reject(serverError);
					else resolve(response);
				});
			}
		});
	}

	public async sendRequest(
		method: string,
		data?:
			CreateWebRtcTransport |
			ConnectWebRtcTransport |
			ProduceData |
			ConsumerData |
			JoinData |
			PauseProducerData |
			ResumeProducerData |
			DisplayNameData |
			undefined,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): Promise<any> {
		logger.debug('sendRequest() [method:%s, data:%o]', method, data);

		for (let tries = 0; tries < edumeetConfig.requestRetries; tries++) {
			try {
				return await this.sendRequestOnWire({ method, data });
			} catch (error) {
				if (
					error instanceof SocketTimeoutError &&
					tries < edumeetConfig.requestRetries
				)
					logger.warn('sendRequest() | timeout, retrying [attempt:%s]', tries);
				else
					throw error;
			}
		}
	}
}