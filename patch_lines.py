import sys

with open('game.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = """  create(){
    /* Themes */
    this.themes = ['beach', 'city', 'desert', 'halloween', 'mexican', 'church'];
    this.currentThemeIndex = 0;
    
    /* World */
    this.bgFar = this._scaledBg(0, H, `bg_${this.themes[0]}_far`, 0);
    this.bgMid = this._scaledBg(0, H, `bg_${this.themes[0]}_mid`, 1);
    this.gndTile = this._scaledBg(H - 85, 85, `floor_${this.themes[0]}`, 3);
    
    /* Variables */
    this.lives = 3;

    /* Couple */
    this.coupleImg=this.add.image(120,GROUND_Y,'novios_running01').setOrigin(.5,1).setDepth(10);
    let coupleTex = this.textures.get('novios_running01').getSourceImage();
    let coupleScale = coupleTex && coupleTex.height ? 100 / coupleTex.height : 1;
    this.coupleImg.setScale(coupleScale);
    this.coupleAnim=new Anim(this.coupleImg,ANIMS.novios.run,7);
    this.shadow=this.add.ellipse(120,GROUND_Y+4,80,12,0,0.18).setDepth(3);

    /* Vale */
    this.valeImg=this.add.image(W + Phaser.Math.Between(800, 2500),GROUND_Y,'vale_walking01').setOrigin(.5,1).setDepth(8);
    let valeTex = this.textures.get('vale_walking01').getSourceImage();
    let valeScale = valeTex && valeTex.height ? 90 / valeTex.height : 1;
    this.valeImg.setScale(valeScale);
    this.valeAnim=new Anim(this.valeImg,ANIMS.vale.walk,3);

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

  _jump(){
    if(this.victoryStarted) return;
    if(this._jc>=2) return;
    this.coupleVelY=-510; this._jc++; this.isGrounded=false;
    this.coupleAnim.set(ANIMS.novios.jump,6);
    this._tone(440,.08,'square');
    this._burst();
  }

  update(_t,dt){
    if(this.victoryStarted) return;
    const dts=dt/1000;
    const spd=this.boosted?this.speed*1.4:this.speed;

    this.distance+=spd*dts*.05;
    this.score+=Math.round(spd*dts*.28);
    this.speed=Math.min(this.speed+SPEEDS.accelPerSec*dts,SPEEDS.max);

    if(this.distance>=GOAL_DIST){ this._victory(); return; }

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
        this.gndTile = this._scaledBg(H - 85, 85, `floor_${this.themes[nextThemeIndex]}`, 3);
    }

    this.bgFar.tilePositionX +=spd*.08*dts;
    this.bgMid.tilePositionX +=spd*.25*dts;
    this.gndTile.tilePositionX+=spd*dts;

    /* Physics */
    if(!this.isGrounded){
      this.coupleVelY+=1380*dts;
      this.coupleImg.y+=this.coupleVelY*dts;
    }
    if(this.coupleImg.y>=GROUND_Y){
      this.coupleImg.y=GROUND_Y; this.coupleVelY=0;
      if(!this.isGrounded){ this.isGrounded=true; this._jc=0; this.coupleAnim.set(ANIMS.novios.run,7); }
    }
    const pct=Math.max(0,1-(GROUND_Y-this.coupleImg.y)/180);
    this.shadow.setScale(pct,1).setAlpha(.18*pct).setPosition(this.coupleImg.x,GROUND_Y+4);

    /* Vale */
    this.valeImg.x -= spd * dts;
    if(this.valeImg.x < -100) {
        this.valeImg.x = W + Phaser.Math.Between(800, 2500);
    }
    this.valeAnim.update(dt);
    this.coupleAnim.update(dt);

    /* Spawn */
    this.spawnT+=dt;
    const interval=Math.max(1100,2600-this.distance*.5);
    if(this.spawnT>interval){ this.spawnT=0; Math.random()<.55?this._spawnItem():this._spawnCat(); }

    /* Move objects */
    this.items.getChildren().forEach(o=>{ o.x-=spd*dts; if(o.x<-70) o.destroy(); });
    this.cats.getChildren().forEach(c=>{ c.x-=spd*dts; if(c.catAnim) c.catAnim.update(dt); if(c.x<-90) c.destroy(); });

    /* HUD */
    this.elapsed+=dts;
"""

final = "".join(lines[:362]) + new_content + "".join(lines[402:])
with open('game.html', 'w', encoding='utf-8') as f:
    f.write(final)
