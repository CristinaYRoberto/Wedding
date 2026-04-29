import re

with open('game.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Remove 'portada' from BG_KEYS
html = html.replace(",'portada'", "")

# 2. Add 'portada' loading to BootScene
html = html.replace("BG_KEYS.forEach(k=>this.load.image(k,`assets/bg/${k}.png`));", "BG_KEYS.forEach(k=>this.load.image(k,`assets/bg/${k}.png`));\n    this.load.image('portada', 'assets/UI/GamePortada.png');")

# 3. Add scaler helper to GameScene and update create to scale backgrounds properly
new_create = """  _scaledBg(y, height, key, depth) {
    let tex = this.textures.get(key).getSourceImage();
    let scale = tex && tex.height ? height / tex.height : 1;
    let w = W / scale;
    let ts = this.add.tileSprite(0, y, w, tex ? tex.height : height, key).setOrigin(0,0).setDepth(depth).setScale(scale);
    return ts;
  }

  create(){
    /* Themes */
    this.themes = ['beach', 'city', 'desert', 'halloween', 'mexican', 'church'];
    this.currentThemeIndex = 0;
    
    /* World */
    // We scale the far and mid to cover H (360), and floor to cover 70 from GROUND_Y
    this.bgFar = this._scaledBg(0, H, `bg_${this.themes[0]}_far`, 0);
    this.bgMid = this._scaledBg(0, H, `bg_${this.themes[0]}_mid`, 1);
    this.gndTile = this._scaledBg(GROUND_Y, 70, `floor_${this.themes[0]}`, 3);
    
    /* Variables */
    this.lives = 3;

    /* Couple */
    this.coupleImg=this.add.image(120,GROUND_Y,'novios_running01').setOrigin(.5,1).setDepth(10);
    let coupleTex = this.textures.get('novios_running01').getSourceImage();
    let coupleScale = coupleTex && coupleTex.height ? 90 / coupleTex.height : 1;
    this.coupleImg.setScale(coupleScale);
    this.coupleAnim=new Anim(this.coupleImg,ANIMS.novios.run,7);
    this.shadow=this.add.ellipse(120,GROUND_Y+4,80,12,0,0.18).setDepth(3);

    /* Vale */
    this.valeImg=this.add.image(W+80,GROUND_Y,'vale_idle-Cel01').setOrigin(.5,1).setDepth(8);
    let valeTex = this.textures.get('vale_idle-Cel01').getSourceImage();
    let valeScale = valeTex && valeTex.height ? 80 / valeTex.height : 1;
    this.valeImg.setScale(valeScale);
    this.valeAnim=new Anim(this.valeImg,ANIMS.vale.idle,3);

    /* Groups */
    this.items=this.add.group();
    this.cats =this.add.group();

    /* HUD */
    this.add.graphics().setDepth(50).fillStyle(0,0.45).fillRect(0,0,W,46);
    this.scoreTxt=this.add.text(12,8,'PUNTOS  0',{fontFamily:'Cinzel',fontSize:'13px',color:'#f5d87a'}).setDepth(51);
    this.distTxt =this.add.text(W/2,8,'0 m',{fontFamily:'Cinzel',fontSize:'13px',color:'#fff'}).setOrigin(.5,0).setDepth(51);
    this.timeTxt =this.add.text(W-12,8,'0:00',{fontFamily:'Cinzel',fontSize:'13px',color:'#aaddff'}).setOrigin(1,0).setDepth(51);
    this.add.graphics().setDepth(51).lineStyle(1,0x444400,1).strokeRect(W/2-150,30,300,10);
    this.add.graphics().setDepth(52).fillStyle(0xffd700,1).fillCircle(W/2+150,35,6);
    this.progBar=this.add.graphics().setDepth(52);

    this.livesTxt=this.add.text(12,28,'❤️❤️❤️',{fontFamily:'Lato',fontSize:'11px',color:'#ff4444'}).setDepth(52);
    this.shTxt=this.add.text(80,28,'',{fontFamily:'Lato',fontSize:'11px',color:'#44aaff'}).setDepth(52);
    this.bsTxt=this.add.text(140,28,'',{fontFamily:'Lato',fontSize:'11px',color:'#ffaa00'}).setDepth(52);

    /* Input */
    this.input.keyboard.on('keydown-SPACE',()=>this._jump());
    this.input.keyboard.on('keydown-UP',   ()=>this._jump());
    this.input.on('pointerdown',p=>{ if(p.y>50) this._jump(); });
  }"""
html = re.sub(r"\s*create\(\)\{.*?_jump\(\);\s*\}\s*\n  \}\n", "\n" + new_create + "\n", html, flags=re.DOTALL)

# 4. Update the _spawnItem and _spawnCat to scale the items nicely
new_spawn = """
  _spawnItem(){
    const ptsTypes=['points_01','points_02','points_03','points_04'];
    const blockerMoneyTypes=['blocker_money_01','blocker_money_02','blocker_money_03','blocker_money-04'];
    const blockerLifeTypes=['blocker_life-01','blocker_life-02','blocker_life-03'];
    const powerupTypes=['booster','life','shield'];
    
    let type = '';
    let category = '';
    let r = Math.random();
    if(r < 0.5) {
        type = Phaser.Utils.Array.GetRandom(ptsTypes); category = 'points';
    } else if(r < 0.7) {
        type = Phaser.Utils.Array.GetRandom(blockerMoneyTypes); category = 'block_money';
    } else if(r < 0.9) {
        type = Phaser.Utils.Array.GetRandom(blockerLifeTypes); category = 'block_life';
    } else {
        type = Phaser.Utils.Array.GetRandom(powerupTypes); category = 'powerup';
    }
    
    // scale down items to around 40px height
    let oTex = this.textures.get(type).getSourceImage();
    let oScale = oTex && oTex.height ? 40 / oTex.height : 1;

    const y=Math.random()<.65?GROUND_Y-20:GROUND_Y-78-Math.random()*48;
    const o=this.add.image(W+42,y,type).setDepth(7);
    
    o.setScale(oScale);

    o.itemType=type; o.category=category; this.items.add(o);
  }

  _spawnCat(){
    const defs=[
      {key:'iker', effect:'shield'},
      {key:'finch',effect:'points'},
      {key:'pilly',effect:'boost'},
    ];
    const d=Phaser.Utils.Array.GetRandom(defs);
    const frames=Math.random()<.35?ANIMS[d.key].sleep:ANIMS[d.key].walk;
    const c=this.add.image(W+64,GROUND_Y,frames[0]).setOrigin(.5,1).setDepth(9);
    
    let cTex = this.textures.get(frames[0]).getSourceImage();
    let cScale = cTex && cTex.height ? 40 / cTex.height : 1;
    c.setScale(cScale);

    c.catKey=d.key; c.catEffect=d.effect;
    c.catAnim=new Anim(c,frames,5);
    c.setInteractive();
    c.on('pointerdown',()=>this._pet(c));
    this.cats.add(c);
  }
"""
html = re.sub(r"\s*_spawnItem\(\)\{.*?\}\n\s*_spawnCat\(\)\{.*?\}\n", "\n" + new_spawn, html, flags=re.DOTALL)

# 5. Fix theme background refreshing in update()
new_update_themes = """
    /* Themes */
    const expectedTheme = Math.floor(this.distance / (GOAL_DIST / this.themes.length));
    const nextThemeIndex = Math.min(expectedTheme, this.themes.length - 1);
    if(nextThemeIndex > this.currentThemeIndex) {
        this.currentThemeIndex = nextThemeIndex;
        this.bgFar.destroy();
        this.bgMid.destroy();
        this.gndTile.destroy();
        this.bgFar = this._scaledBg(0, H, `bg_${this.themes[nextThemeIndex]}_far`, 0);
        this.bgMid = this._scaledBg(0, H, `bg_${this.themes[nextThemeIndex]}_mid`, 1);
        this.gndTile = this._scaledBg(GROUND_Y, 70, `floor_${this.themes[nextThemeIndex]}`, 3);
    }

    this.bgFar.tilePositionX +=spd*.08*dts;
    this.bgMid.tilePositionX +=spd*.25*dts;
    this.gndTile.tilePositionX+=spd*dts;
"""
html = re.sub(r"\s*/\*\ Themes\ \*/.*?(?=/\*\ Physics\ \*/)", "\n" + new_update_themes + "\n    ", html, flags=re.DOTALL)

with open('game.html', 'w', encoding='utf-8') as f:
    f.write(html)
