import re

with open('game.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. GROUND_Y to H-35
html = re.sub(r'GROUND_Y=H-70', 'GROUND_Y=H-35', html)

# 2. Floor shifting to H-85, 85 height
html = html.replace('this._scaledBg(GROUND_Y, 70,', 'this._scaledBg(H - 85, 85,')

# 3. Scales & initial Vale position
html = html.replace('120,GROUND_Y,\'novios_running01\'', '120,GROUND_Y,\'novios_running01\'')
html = html.replace('? 90 / coupleTex.height', '? 100 / coupleTex.height')
html = html.replace('W+80,GROUND_Y,\'vale_idle-Cel01\'', 'W + Phaser.Math.Between(800, 2500),GROUND_Y,\'vale_walking01\'')
html = html.replace('vale_idle-Cel01\').getSourceImage()', 'vale_walking01\').getSourceImage()')
html = html.replace('? 80 / valeTex.height', '? 90 / valeTex.height')
html = html.replace('ANIMS.vale.idle', 'ANIMS.vale.walk')

# 4. Item Scales
html = html.replace('? 40 / oTex.height', '? 60 / oTex.height')
html = html.replace('? 40 / cTex.height', '? 60 / cTex.height')

# 5. Physics for Vale
new_vale_phys = """    /* Vale */
    this.valeImg.x -= spd * dts;
    if(this.valeImg.x < -100) {
        this.valeImg.x = W + Phaser.Math.Between(800, 2500);
    }
    this.valeAnim.update(dt);"""
html = re.sub(r'/\*\ Vale\ \*/[\s\S]*?this\.valeAnim\.update\(dt\);', new_vale_phys, html)

# 6. Physics for Cats (remove .55 factor)
html = html.replace('c.x-=spd*.55*dts;', 'c.x-=spd*dts;')


with open('game.html', 'w', encoding='utf-8') as f:
    f.write(html)
