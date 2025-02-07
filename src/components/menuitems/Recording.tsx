import { MenuItem } from '@mui/material';
import {
	useAppDispatch,
	useAppSelector,
	usePermissionSelector,
} from '../../store/hooks';
import {
	startRecordingLabel, stopRecordingLabel,
} from '../translated/translatedComponents';
import RecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import { MenuItemProps } from '../floatingmenu/FloatingMenu';
import { permissions } from '../../utils/roles';
import MoreActions from '../moreactions/MoreActions';
import { recordingActions } from '../../store/slices/recordingSlice';

const Recording = ({
	onClick
}: MenuItemProps): JSX.Element => {
	const dispatch = useAppDispatch();
	const hasRecordingPermission = usePermissionSelector(permissions.LOCAL_RECORD_ROOM);
	const canRecord = useAppSelector((state) => state.me.canRecord);
	const recording = useAppSelector((state) => state.recording.recording);
	const recordTip = recording ? stopRecordingLabel() : startRecordingLabel();

	return (
		<MenuItem
			aria-label={recordTip}
			disabled={!hasRecordingPermission || !canRecord}
			onClick={() => {
				onClick();

				recording ?
					dispatch(recordingActions.stop()) :
					dispatch(recordingActions.start());
			}}
		>
			{ recording ? <StopIcon /> : <RecordIcon /> }
			<MoreActions>
				{ recordTip }
			</MoreActions>
		</MenuItem>
	);
};

export default Recording;