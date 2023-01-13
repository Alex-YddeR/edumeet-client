import { Logger, skipIfClosed } from 'edumeet-common';
import EventEmitter from 'events';
import { MediaKind } from 'mediasoup-client/lib/RtpParameters';

const logger = new Logger('P2PConsumer');

interface P2PConsumerOptions {
	rtpReceiver: RTCRtpReceiver;
	track: MediaStreamTrack;
	appData?: Record<string, unknown>;
}

export declare interface P2PConsumer {
	// eslint-disable-next-line
	on(event: 'close', listener: () => void): this;
	// eslint-disable-next-line
	on(event: 'trackended', listener: () => void): this;
}

export class P2PConsumer extends EventEmitter {
	public closed = false;
	public id: string;
	public paused: boolean;
	public track: MediaStreamTrack;
	public rtpReceiver: RTCRtpReceiver;
	public kind: MediaKind;
	public appData: Record<string, unknown>;

	constructor({
		rtpReceiver,
		track,
		appData = {}
	}: P2PConsumerOptions) {
		super();

		logger.debug('constructor() [id:%s]', track.id);

		this.id = track.id;
		this.paused = !track.enabled;
		this.rtpReceiver = rtpReceiver;
		this.track = track;
		this.kind = track.kind as MediaKind;
		this.appData = appData;
		this.onTrackEnded = this.onTrackEnded.bind(this);
		this.handleTrack();
	}

	@skipIfClosed
	public close(): void {
		logger.debug('close() [id:%s]', this.id);

		this.closed = true;

		this.destroy();
		this.emit('close');
	}

	@skipIfClosed
	public pause(): void {
		logger.debug('pause()');

		if (this.paused)
			return logger.debug('pause() | Producer is already paused');

		this.paused = true;
		this.track.enabled = false;
	}

	@skipIfClosed
	public resume(): void {
		logger.debug('resume()');

		if (!this.paused)
			return logger.debug('resume() | Producer is already resumed');

		this.paused = false;
		this.track.enabled = true;
	}

	private handleTrack(): void {
		this.track.addEventListener('ended', this.onTrackEnded);
	}

	private onTrackEnded(): void {
		this.emit('trackended');
	}

	private destroy(): void {
		try {
			this.track.removeEventListener('ended', this.onTrackEnded);
			this.track.stop();
		} catch (error) {}
	}
}