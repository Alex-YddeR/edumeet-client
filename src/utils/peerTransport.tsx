import { AwaitQueue } from 'awaitqueue';
import { Logger, skipIfClosed } from 'edumeet-common';
import EventEmitter from 'events';
import { P2PConsumer } from './P2PConsumer';
import { P2PProducer } from './P2PProducer';

interface PeerTransportOptions {
	id: string;
	settings?: PeerTransportSettings;
	polite: boolean;
}

interface PeerTransportSettings {
	iceServers?: RTCIceServer[];
	iceTransportPolicy?: RTCIceTransportPolicy;
	bundlePolicy?: RTCBundlePolicy;
	rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

const defaultSettings: PeerTransportSettings = {
	iceServers: [],
};

const logger = new Logger('PeerTransport');

export declare interface PeerTransport {
	// eslint-disable-next-line
	on(event: 'state', listener: (state: RTCIceConnectionState) => void): this;
	// eslint-disable-next-line
	on(event: 'newP2PConsumer', listener: (p2pConsumer: P2PConsumer) => void): this;
	// eslint-disable-next-line
	on(event: 'offer', listener: (sessionDescription: RTCSessionDescription) => void): this;
	// eslint-disable-next-line
	on(event: 'answer', listener: (sessionDescription: RTCSessionDescription) => void): this;
	// eslint-disable-next-line
	on(event: 'candidate', listener: (candidate: RTCIceCandidate) => void): this;
}

export class PeerTransport extends EventEmitter {
	public id: string;
	public polite: boolean;
	public closed = false;

	private pc: RTCPeerConnection;
	private queue: AwaitQueue;
	private makingOffer = false;
	private ignoreOffer = false;

	constructor({
		id,
		settings = defaultSettings,
		polite,
	}: PeerTransportOptions) {
		super();

		logger.debug('constructor() [id:%s]', id);

		this.id = id;
		this.polite = polite;

		this.pc = new RTCPeerConnection(settings);
		this.queue = new AwaitQueue();

		this.handlePeerConnection();
	}

	@skipIfClosed
	public close(): void {
		logger.debug('close() [id:%s]', this.id);

		this.closed = true;

		try { this.pc.close(); } catch (error) {}
		this.queue.close();
	}

	@skipIfClosed
	public async produce(
		track: MediaStreamTrack,
		appData: Record<string, unknown> = {}
	): Promise<P2PProducer> {
		logger.debug('produce() [id:%s]', this.id);

		const transceiver = this.pc.addTransceiver(track);

		const p2pProducer = new P2PProducer({
			rtpSender: transceiver.sender,
			track,
			appData
		});

		return p2pProducer;
	}

	@skipIfClosed
	public async onRemoteOffer(offer: RTCSessionDescription): Promise<void> {
		logger.debug('onRemoteOffer() [id:%s]', this.id);

		this.queue.push(async () => {
			const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';

			this.ignoreOffer = !this.polite && offerCollision;

			if (this.ignoreOffer)
				return logger.debug('OnRemoteOffer() | ignoring offer');

			try {
				if (offerCollision) {
					await Promise.all([
						this.pc.setLocalDescription({ type: 'rollback' }),
						this.pc.setRemoteDescription(offer)
					]);
				} else
					await this.pc.setRemoteDescription(offer);

				await this.pc.setLocalDescription();

				this.emit('answer', this.pc.localDescription);
			} catch (error) {
				logger.error('onRemoteOffer() [error:"%o"]', error);
			}
		});
	}

	@skipIfClosed
	public async onRemoteAnswer(answer: RTCSessionDescription): Promise<void> {
		logger.debug('onRemoteAnswer() [id:%s]', this.id);

		this.queue.push(async () => {
			this.ignoreOffer = false;

			try {
				await this.pc.setRemoteDescription(answer);
			} catch (error) {
				logger.error('onRemoteAnswer() [error:"%o"]', error);
			}
		});
	}

	@skipIfClosed
	public async onRemoteCandidate(candidate: RTCIceCandidate): Promise<void> {
		logger.debug('onRemoteCandidate() [id:%s]', this.id);

		this.queue.push(async () => {
			try {
				await this.pc.addIceCandidate(candidate);
			} catch (error) {
				if (!this.ignoreOffer)
					logger.error('onRemoteCandidate() [error:"%o"]', error);
			}
		});
	}

	@skipIfClosed
	private handlePeerConnection(): void {
		this.pc.oniceconnectionstatechange = () => {
			if (this.pc.iceConnectionState === 'failed')
				this.pc.restartIce();

			if (!this.closed)
				this.emit('state', this.pc.iceConnectionState);
		};

		this.pc.onicecandidate = ({ candidate }) => {
			this.emit('candidate', candidate);
		};

		this.pc.onnegotiationneeded = async () => {
			try {
				this.makingOffer = true;

				await this.pc.setLocalDescription();

				this.emit('offer', this.pc.localDescription);
			} catch (error) {
				logger.error('onnegotiationneeded() [id:%s] [error:%o]', this.id, error);
			} finally {
				this.makingOffer = false;
			}
		};

		this.pc.ontrack = ({ track, receiver }) => {
			logger.debug('ontrack() [id:%s]', this.id);

			const p2pConsumer = new P2PConsumer({
				rtpReceiver: receiver,
				track,
			});

			this.emit('newP2PConsumer', p2pConsumer);
		};
	}
}