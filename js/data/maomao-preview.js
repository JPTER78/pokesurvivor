/* Maomao: visual playtest only. Never part of DEX, gacha or wild encounters. */
G.MaomaoPreview = (() => {
  const enabled = new URLSearchParams(location.search).get('maomao') === '1';
  const mon = Object.freeze({ dex: 10001, name: 'Maomao', types: ['poison', 'grass'],
    hp: 110, spd: 112, atk: 1.25, rarity: 5, bst: 530, gen: 0,
    start: 'poison-sting', customPreview: true });
  function allowed() {
    return enabled && !G.FIREBASE_CONFIG && G.DB.guest &&
      !G.Coop.active && !G.Social.room && G.Game.state === 'ui';
  }
  return { enabled, mon, allowed };
})();

if (G.MaomaoPreview.enabled) {
  G.DEX_BY[10001] = G.MaomaoPreview.mon;
  G.SPRITE_META[10001] = {"s":1,"a":{"Idle":{"w":40,"h":44,"n":1,"r":8,"d":[40],"ax":20,"ay":39},"Walk":{"w":40,"h":44,"n":2,"r":8,"d":[9,9],"ax":20,"ay":39},"Attack":{"w":40,"h":44,"n":3,"r":8,"d":[9,9,9],"ax":20,"ay":39},"Shoot":{"w":40,"h":44,"n":3,"r":8,"d":[9,9,9],"ax":20,"ay":39},"Charge":{"w":40,"h":44,"n":2,"r":8,"d":[9,9],"ax":20,"ay":39},"Faint":{"w":40,"h":44,"n":3,"r":8,"d":[12,12,30],"ax":20,"ay":39},"Hurt":{"w":40,"h":44,"n":1,"r":8,"d":[9],"ax":20,"ay":39}}};
}
