import re

def update_game_html():
    with open('game.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Update Asset keys array
    new_bg_keys = "const BG_KEYS=['bg_beach_far','bg_beach_mid','bg_church_far','bg_church_mid','bg_church_prop01','bg_city_far','bg_city_mid','bg_desert_far','bg_desert_mid','bg_halloween_far','bg_halloween_mid','bg_mexican_far','bg_mexican_mid','floor_beach','floor_church','floor_city','floor_desert','floor_halloween','floor_mexican','win_church_background','win_church_people','win_floor_church','portada'];"
    html = re.sub(r"const BG_KEYS=\[[^\]]+\];", new_bg_keys, html)

    new_prop_keys = "const PROP_KEYS=['blocker_life-01','blocker_life-02','blocker_life-03','blocker_money-04','blocker_money_01','blocker_money_02','blocker_money_03','booster','life','points_01','points_02','points_03','points_04','points_05','shield'];"
    html = re.sub(r"(const CHAR_KEYS=\[[\s\S]+?\];)\n+\s*const BG_KEYS", r"\1\n" + new_prop_keys + "\n" + new_bg_keys, html)

    # 2. Add loading of props in BootScene
    prop_loader = "    PROP_KEYS.forEach(k=>this.load.image(k,`assets/props/${k}.png`));"
    html = html.replace("BG_KEYS.forEach(k=>this.load.image(k,`assets/bg/${k}.png`));", "BG_KEYS.forEach(k=>this.load.image(k,`assets/bg/${k}.png`));\n" + prop_loader)

    # 3. Increase total in BootScene
    html = html.replace("const total=CHAR_KEYS.length+BG_KEYS.length;", "const total=CHAR_KEYS.length+BG_KEYS.length+PROP_KEYS.length;")

    # 4. Remove placeholder generation
    # html = re.sub(r"this\._makePlaceholders\(\);\n", "", html)

    # 5. Modify GameScene create to handle backgrounds
    new_create = """
  create(){
    /* Themes */
    this.themes = ['beach', 'city', 'desert', 'halloween', 'mexican', 'church'];
    this.currentThemeIndex = 0;
    
    /* World */
    this.bgFar  =this.add.tileSprite(0,0,W,120,`bg_${this.themes[0]}_far`).setOrigin(0,0).setDepth(0);
    this.bgMid  =this.add.tileSprite(0,80,W,160,`bg_${this.themes[0]}_mid`).setOrigin(0,0).setDepth(1);
    this.gndTile=this.add.tileSprite(0,GROUND_Y,W,70,`floor_${this.themes[0]}`).setOrigin(0,0).setDepth(3);
    
    /* Variables */
    this.lives = 3;

    /* Couple */
    this.coupleImg=this.add.image(120,GROUND_Y,'novios_running01').setOrigin(.5,1).setScale(.72).setDepth(10);
    this.coupleAnim=new Anim(this.coupleImg,ANIMS.novios.run,7);
    this.shadow=this.add.ellipse(120,GROUND_Y+4,80,12,0,0.18).setDepth(3);

    /* Vale */
    this.valeImg=this.add.image(W+80,GROUND_Y,'vale_idle-Cel01').setOrigin(.5,1).setScale(.78).setDepth(8);
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
  }
"""
    html = re.sub(r"create\(\)\{.*?_jump\(\);\s*\}\s*\n  \}\n", new_create, html, flags=re.DOTALL)

    # 6. Update themes in update()
    theme_updater = """
    /* Themes */
    const expectedTheme = Math.floor(this.distance / (GOAL_DIST / this.themes.length));
    const nextThemeIndex = Math.min(expectedTheme, this.themes.length - 1);
    if(nextThemeIndex > this.currentThemeIndex) {
        this.currentThemeIndex = nextThemeIndex;
        this.bgFar.setTexture(`bg_${this.themes[nextThemeIndex]}_far`);
        this.bgMid.setTexture(`bg_${this.themes[nextThemeIndex]}_mid`);
        this.gndTile.setTexture(`floor_${this.themes[nextThemeIndex]}`);
    }"""
    html = html.replace("this.bgFar.tilePositionX +=spd*.08*dts;", theme_updater + "\n\n    this.bgFar.tilePositionX +=spd*.08*dts;")

    # Also remove bgNear from update
    html = re.sub(r"this\.bgNear\.tilePositionX\+=spd\*\.6\*dts;\n", "", html)

    # 7. Modify item spawning
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
    
    const y=Math.random()<.65?GROUND_Y-20:GROUND_Y-78-Math.random()*48;
    const o=this.add.image(W+42,y,type).setDepth(7);
    o.itemType=type; o.category=category; this.items.add(o);
  }
"""
    html = re.sub(r"_spawnItem\(\)\{.*?\}\n", new_spawn, html, flags=re.DOTALL)

    # 8. Hit processing
    new_collide = """  _collide(){
    if(this.victoryStarted) return;
    const cx=this.coupleImg.x, cy=this.coupleImg.y;
    this.items.getChildren().forEach(item=>{
      const dx=item.x-cx,dy=item.y-cy;
      if(Math.sqrt(dx*dx+dy*dy)<56){
        if(item.category === 'points'){
             const pts={points_01:100,points_02:200,points_03:300,points_04:150};
             const cols={points_01:0xff8844,points_02:0xffdd44,points_03:0x44cc44,points_04:0xff88cc};
             this.score+=pts[item.itemType]||100;
             this._popup(item.x,item.y,`+${pts[item.itemType]||100}`,cols[item.itemType]||0xffffff);
             this._chime();
        } else if(item.category === 'block_money'){
             if(!this.shielded){
                 this.score=Math.max(0, this.score - 200);
                 this._popup(item.x,item.y,`-200 RESTA DINERO`,0xff4444);
                 this._tone(120,.25,'sawtooth');
                 this._hitEffect();
             } else {
                 this._popup(item.x,item.y,`BLOCKED!`,0x44aaff);
             }
        } else if(item.category === 'block_life'){
             if(!this.shielded){
                  this.lives--;
                  this._popup(item.x,item.y,`-1 VIDA`,0xff4444);
                  this.updateLives();
                  if(this.lives <= 0) {
                      this._gameOver(); return;
                  }
                  this._tone(120,.25,'sawtooth');
                  this._hitEffect();
             } else {
                 this._popup(item.x,item.y,`BLOCKED!`,0x44aaff);
             }
        } else if(item.category === 'powerup'){
             if(item.itemType === 'life') {
                  this.lives = Math.min(this.lives + 1, 5);
                  this.updateLives();
                  this._popup(item.x,item.y,`+1 VIDA`,0xff4444);
                  this._chime();
             } else if(item.itemType === 'shield') {
                  this.shielded=true; this.shieldT=5000; this._popup(item.x,item.y,'🛡 ¡ESCUDO!',0x44aaff); this._chime();
             } else if(item.itemType === 'booster') {
                  this.boosted=true; this.boostT=5000; this.speed=Math.min(this.speed*1.45,SPEEDS.max); this._popup(item.x,item.y,'⚡ ¡BOOST!',0xffaa00); this._tone(660,.2,'square');
             }
        }
        item.destroy();
      }
    });
    if(this.valeImg&&!this._hit){
      const dx=Math.abs(this.valeImg.x-cx);
      if(dx<54&&!this.shielded){
        const coupleTop=cy-this.coupleImg.displayHeight;
        const valeTop=this.valeImg.y-this.valeImg.displayHeight;
        if(coupleTop>valeTop+52) this._hitVale();
      }
    }
  }

  updateLives(){
     let h = '';
     for(let i=0; i<this.lives; i++) h += '❤️';
     this.livesTxt.setText(h);
  }

  _hitEffect(){
    this.coupleVelY=-275; this.isGrounded=false;
    this.coupleAnim.set(ANIMS.novios.hit,4);
    this.cameras.main.shake(150,.01);
    this.cameras.main.flash(100,255,50,50);
  }

  _gameOver(){
     this.victoryStarted = true;
     this.speed = 0;
     this.time.delayedCall(1500,()=>this.scene.start('Menu')); // simplistic game over
  }
"""
    html = re.sub(r"\s*_collide\(\)\{.*?(?=\s*_hitVale\(\)\{)", "\n" + new_collide, html, flags=re.DOTALL)

    # 9. Modify Victory sequence
    new_victory = """
  _victory(){
    this.victoryStarted=true; this.speed=0;
    this.valeAnim.set(ANIMS.vale.happy,5);
    this.tweens.add({
      targets:[this.bgFar,this.bgMid,this.gndTile],alpha:0,duration:1000,
      onComplete:()=>{
        this.add.image(W/2,H/2,'win_church_background').setDisplaySize(W,H).setDepth(4);
        this.add.image(W/2,H/2,'win_church_people').setDisplaySize(W,H).setDepth(5);
        this.add.image(W/2,H/2,'win_floor_church').setDisplaySize(W,H).setDepth(5);
        this.tweens.add({targets:this.coupleImg,x:W/2-18,duration:2400,ease:'Sine.Out',
          onComplete:()=>{
            this.coupleAnim.set(ANIMS.novios.kiss,5);
            this._chime();
            const bonus=Math.max(0,Math.floor(5000-this.elapsed*10));
            this.score+=bonus;
            const prev=JSON.parse(localStorage.getItem('boda_scores')||'[]');
            prev.unshift({score:this.score,time:Math.round(this.elapsed),date:new Date().toLocaleDateString('es-MX')});
            prev.sort((a,b)=>b.score-a.score);
            localStorage.setItem('boda_scores',JSON.stringify(prev.slice(0,10)));
            this._confetti();
            this.time.delayedCall(3000,()=>this.scene.start('Victory',{score:this.score,elapsed:this.elapsed}));
          }
        });
      }
    });
  }
"""
    html = re.sub(r"\s*_victory\(\)\{.*?(?=\s*_confetti\(\)\{)", "\n" + new_victory, html, flags=re.DOTALL)

    with open('game.html', 'w', encoding='utf-8') as f:
        f.write(html)

update_game_html()
