import { styled } from '@mui/material/styles';
import { Consumer } from 'mediasoup-client/lib/Consumer';
import { Producer } from 'mediasoup-client/lib/Producer';
import { useContext, useEffect, useRef } from 'react';
import { StateConsumer } from '../../store/slices/consumersSlice';
import { StateProducer } from '../../store/slices/producersSlice';
import { ServiceContext } from '../../store/store';
import { ResolutionWatcher } from '../../utils/resolutionWatcher';
import { Logger } from 'edumeet-common';
import { SelfieSegmentation, InputImage } from '@mediapipe/selfie_segmentation';

const logger = new Logger('VideoView');

interface VideoViewProps {
	mirrored?: boolean;
	contain?: boolean;
	zIndex?: number;
	trackId?: string;
	consumer?: StateConsumer;
	producer?: StateProducer;
	blurBackground?: boolean
}

interface VideoProps {
	mirrored?: number;
	contain?: number;
	zindex?: number;
}

const StyledVideo = styled('video')<VideoProps>(({
	theme,
	mirrored,
	contain,
	zindex
}) => ({
	position: 'absolute',
	height: '100%',
	width: '100%',
	...(mirrored && {
		transform: 'scaleX(-1)'
	}),
	objectFit: contain ? 'contain' : 'cover',
	userSelect: 'none',
	backgroundColor: 'rgba(19, 19, 19, 1)',
	backgroundRepeat: 'no-repeat',
	backgroundPosition: 'center center',
	backgroundImage: 'url(data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJsb2FkZXItMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSI0MHB4IiBoZWlnaHQ9IjQwcHgiIHZpZXdCb3g9IjAgMCA1MCA1MCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNTAgNTA7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KCTxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik00My45MzUsMjUuMTQ1YzAtMTAuMzE4LTguMzY0LTE4LjY4My0xOC42ODMtMTguNjgzYy0xMC4zMTgsMC0xOC42ODMsOC4zNjUtMTguNjgzLDE4LjY4M2g0LjA2OGMwLTguMDcxLDYuNTQzLTE0LjYxNSwxNC42MTUtMTQuNjE1YzguMDcyLDAsMTQuNjE1LDYuNTQzLDE0LjYxNSwxNC42MTVINDMuOTM1eiI+CgkJPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlVHlwZT0ieG1sIiBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InJvdGF0ZSIgZnJvbT0iMCAyNSAyNSIgdG89IjM2MCAyNSAyNSIgZHVyPSIwLjZzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSI+PC9hbmltYXRlVHJhbnNmb3JtPgoJPC9wYXRoPgo8L3N2Zz4K)',
	zIndex: zindex ? zindex : 0,
	borderRadius: theme.videoRoundedCorners ? theme.spacing(1) : '0',
}));

const VideoView = ({
	mirrored,
	contain,
	zIndex,
	trackId,
	consumer,
	producer,
	blurBackground
}: VideoViewProps): JSX.Element => {
	const { mediaService } = useContext(ServiceContext);
	const videoElement = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const contextRef = useRef<any>(null);
	
	useEffect(() => {
		logger.error('useEffect()');
		if (canvasRef.current && videoElement.current) {
			contextRef.current = canvasRef.current.getContext('2d');
			const selfieSegmentation = new SelfieSegmentation({
				locateFile: (file) =>
					`https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
			});

			selfieSegmentation.setOptions({
				modelSelection: 1,
				selfieMode: true,
			});

			selfieSegmentation.onResults(onResults);

			const sendToMediaPipe = async () => {
				if (videoElement.current) {
					if (!videoElement.current.videoWidth) {
						requestAnimationFrame(sendToMediaPipe);
					} else {
						await selfieSegmentation.send(
							{ image: videoElement.current as InputImage }
						);
						requestAnimationFrame(sendToMediaPipe);
					}
				} else {
					requestAnimationFrame(sendToMediaPipe);
				}
			};

			sendToMediaPipe();

		} 
	}, [ blurBackground ]);

	const onResults = (results: any) => {
		if (canvasRef.current) {
			contextRef.current.save();
			contextRef.current.clearRect(
				0,
				0,
				canvasRef.current.width,
				canvasRef.current.height
			);

			contextRef.current.drawImage(
				results.segmentationMask,
				0,
				0,
				canvasRef.current.width,
				canvasRef.current.height
			);

			// Only overwrite existing pixels.
			contextRef.current.globalCompositeOperation = 'source-out';
			contextRef.current.fillStyle = '#00FF00';
			contextRef.current.fillRect(
				0,
				0,
				canvasRef.current.width,
				canvasRef.current.height
			);

			// Only overwrite missing pixels.
			contextRef.current.globalCompositeOperation = 'destination-atop';
			contextRef.current.drawImage(
				results.image,
				0,
				0,
				canvasRef.current.width,
				canvasRef.current.height
			);

			contextRef.current.restore();
		}
	};
	
	useEffect(() => {
		let media: Consumer | Producer | undefined;
		let track: MediaStreamTrack | null | undefined;

		if (consumer)
			media = mediaService.getConsumer(consumer.id);
		else if (producer)
			media = mediaService.getProducer(producer.id);

		if (media)
			({ track } = media);
		else if (trackId)
			track = mediaService.getTrack(trackId);

		if (!track || !videoElement.current) return;

		const stream = new MediaStream();
		
		stream.addTrack(track);
		videoElement.current.srcObject = stream;
		videoElement.current.play().catch();

		return () => {
			if (videoElement.current) {
				videoElement.current.srcObject = null;
				videoElement.current.onplay = null;
				videoElement.current.onpause = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!consumer)
			return;

		const actualConsumer = mediaService.getConsumer(consumer.id);
		
		if (!actualConsumer)
			return;

		const {
			resolutionWatcher
		}: {
			resolutionWatcher?: ResolutionWatcher
		} = actualConsumer.appData;

		const resolutionReporter = resolutionWatcher?.createResolutionReporter();

		if (!resolutionReporter || !videoElement.current)
			return;

		const resizeObserver = new ResizeObserver((entries) => {
			const {
				contentRect: {
					width,
					height
				}
			} = entries[0];

			resolutionReporter.updateResolution({ width, height });
		});

		resizeObserver.observe(videoElement.current);

		return () => {
			resizeObserver.disconnect();
			resolutionReporter.close();
		};
	}, []);

	// Props workaround for: https://github.com/mui/material-ui/issues/25925
	return (
		<>
			<canvas ref={canvasRef} width={520} height={292} />
			<div style={{ overflow: 'hidden',
				position: 'relative' }}>
				<video ref={videoElement} style={
					{ position: 'absolute',
						right: '-2500px' }
				}/>
			</div>
			{/* <StyledVideo
				ref={videoElement}
				autoPlay
				playsInline
				muted
				controls={false}
				mirrored={mirrored ? 1 : 0}
				contain={contain ? 1 : 0}
				zindex={zIndex ? zIndex : 0}
			/> */}
		</>
	);
};

export default VideoView;