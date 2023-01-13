import { Logger, skipIfClosed } from 'edumeet-common';
import EventEmitter from 'events';
import { MediaKind } from 'mediasoup-client/lib/RtpParameters';

const logger = new Logger('P2PProducer');

interface P2PProducerOptions {
	rtpSender: RTCRtpSender;
	track: MediaStreamTrack;
	appData?: Record<string, unknown>;
}

export declare interface P2PProducer {
	// eslint-disable-next-line
	on(event: 'close', listener: () => void): this;
	// eslint-disable-next-line
	on(event: 'trackended', listener: () => void): this;
}

export class P2PProducer extends EventEmitter {
	public closed = false;
	public id: string;
	public paused: boolean;
	public track: MediaStreamTrack | null;
	public rtpSender: RTCRtpSender;
	public kind: MediaKind;
	public appData: Record<string, unknown>;

	constructor({
		rtpSender,
		track,
		appData = {}
	}: P2PProducerOptions) {
		super();

		logger.debug('constructor() [id:%s]', track.id);

		this.id = track.id;
		this.paused = !track.enabled;
		this.rtpSender = rtpSender;
		this.track = track;
		this.kind = track.kind as MediaKind;
		this.appData = appData;

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

		if (this.paused || !this.track)
			return logger.debug('pause() | Producer is already paused or no track');

		this.paused = true;
		this.track.enabled = false;
	}

	@skipIfClosed
	public resume(): void {
		logger.debug('resume()');

		if (!this.paused || !this.track)
			return logger.debug('resume() | Producer is already resumed or no track');

		this.paused = false;
		this.track.enabled = true;
	}

	@skipIfClosed
	public async replaceTrack({
		track
	}: { track: MediaStreamTrack | null }): Promise<void> {
		logger.debug('replaceTrack() [track:%o]', track);

		if (track && track.readyState === 'ended')
			throw new Error('track ended');

		// Do nothing if this is the same track as the current handled one.
		if (track === this.track)
			return logger.debug('replaceTrack() | same track, ignored');

		await this.rtpSender.replaceTrack(track);

		// Destroy the previous track.
		this.destroy();

		// Set the new track.
		this.track = track;

		// If this Producer was paused/resumed and the state of the new
		// track does not match, fix it.
		if (this.track) {
			if (!this.paused)
				this.track.enabled = true;
			else if (this.paused)
				this.track.enabled = false;
		}

		// Handle the effective track.
		this.handleTrack();
	}

	private handleTrack(): void {
		this.track?.addEventListener('ended', this.onTrackEnded);
	}

	private onTrackEnded(): void {
		this.emit('trackended');
	}

	private destroy(): void {
		try {
			this.track?.removeEventListener('ended', this.onTrackEnded);
			this.track?.stop();
		} catch (error) {}
	}
}