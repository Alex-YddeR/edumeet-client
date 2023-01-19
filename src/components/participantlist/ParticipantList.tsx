import { styled } from '@mui/material';
import { Flipped, Flipper } from 'react-flip-toolkit';
import {
	useAppSelector,
	usePermissionSelector
} from '../../store/hooks';
import { participantListSelector } from '../../store/selectors';
import { permissions } from '../../utils/roles';
import {
	meLabel,
	moderatorActionsLabel,
	participantsLabel,
	countdownTimerActionsLabel
} from '../translated/translatedComponents';
import ListMe from './ListMe';
import ListModerator from './ListModerator';
import ListPeer from './ListPeer';
import CountdownTimer from '../countdowntimer/CountdownTimer';

const ParticipantListDiv = styled('div')(({ theme }) => ({
	width: '100%',
	overflowY: 'auto',
	padding: theme.spacing(1)
}));

const ListUl = styled('ul')(({ theme }) => ({
	listStyleType: 'none',
	padding: theme.spacing(1),
	boxShadow: '0 2px 5px 2px rgba(0, 0, 0, 0.2)',
	backgroundColor: 'rgba(255, 255, 255, 1)'
}));

const ListHeaderLi = styled('li')({
	fontWeight: 'bolder'
});

const ListItemLi = styled('li')({
	width: '100%',
	overflow: 'hidden',
	cursor: 'pointer',
	'&:not(:last-child)': {
		borderBottom: '1px solid #CBCBCB'
	}
});

const ParticipantList = (): JSX.Element => {
	const isModerator = usePermissionSelector(permissions.MODERATE_ROOM);
	const participants = useAppSelector(participantListSelector);

	return (
		<ParticipantListDiv>
			<ListUl>
				<ListHeaderLi>
					{ countdownTimerActionsLabel() }
				</ListHeaderLi>
				<CountdownTimer />
			</ListUl>
			{ isModerator &&
				<ListUl>
					<ListHeaderLi>
						{ moderatorActionsLabel() }
					</ListHeaderLi>
					<ListModerator />
				</ListUl>
			}
			<ListUl>
				<ListHeaderLi>
					{ meLabel()}
				</ListHeaderLi>
				<ListMe />
			</ListUl>
			<ListUl>
				<ListHeaderLi>
					{ participantsLabel() }
				</ListHeaderLi>
				<Flipper flipKey={participants}>
					{ participants.map((peer) => (
						<Flipped key={peer.id} flipId={peer.id}>
							<ListItemLi key={peer.id}>
								<ListPeer peer={peer} isModerator={isModerator} />
							</ListItemLi>
						</Flipped>
					)) }
				</Flipper>
			</ListUl>
		</ParticipantListDiv>
	);
};

export default ParticipantList;