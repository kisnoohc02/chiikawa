// Run the higher level board search away from the touch and drawing thread.
const window = self;
importScripts('board-games.js?v=15');

self.onmessage = ({data}) => {
  const {game,position,level} = data;
  const engine = self.HachiBoardGames._test;
  const move = game === 'omok' ? engine.oBot(position,level) : engine.chessBot(position,level);
  self.postMessage({move});
};
