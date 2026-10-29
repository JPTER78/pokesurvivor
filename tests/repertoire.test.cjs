const {test}=require('node:test');const assert=require('node:assert/strict');
const {game,load}=require('./mega-fixtures.cjs');
test('Repertoire preference needs ownership and purchase, preserves upgrades, and merges latest toggle',()=>{
 const {G}=game(4);load(G,'js/data/upgrades.js');load(G,'js/core/db.js');G.DB.playAsGuest();
 assert.equal(G.DB.repertoireEnabled(4),true);assert.equal(G.DB.setRepertoire(4,false),false);
 G.DB.grant(4,'test');assert.equal(G.DB.setRepertoire(4,false),false);
 G.DB.upgradesOf(4).moves=1;G.DB.save.pstart2[4]='ember';
 const clone=o=>JSON.parse(JSON.stringify(o));const before=clone(G.DB.save);
 assert.equal(G.DB.setRepertoire(4,false),true);assert.equal(G.DB.repertoireEnabled(4),false);
 assert.equal(G.DB.upgradesOf(4).moves,1);assert.equal(G.DB.save.pstart2[4],'ember');
 assert.equal(G.DB.repertoireEnabled(7),true);
 const off=clone(G.DB.save);assert.ok(G.DB.setRepertoire(4,true));const on=clone(G.DB.save);
 for(const [a,b] of [[before,off],[off,before]])assert.ok(G.DB.merge(a,b).repertoire[4]<0);
 for(const [a,b] of [[on,off],[off,on]])assert.ok(G.DB.merge(a,b).repertoire[4]>0);
});
