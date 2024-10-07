import {atom} from 'recoil';

export const panZoomState = atom({
  key: 'panZoomState',
  default: {start: 0, end: 1},
});
