import urllib.request
import os

items = [
    {
        'id': 'kanto_1',
        'badge_name': 'Medalla Roca',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/3/39/Medalla_Roca.png/revision/latest?cb=20120208025843&path-prefix=es',
        'leader_name': 'Brock',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/c/ca/VS_Brock.png/revision/latest?cb=20120219222538&path-prefix=es'
    },
    {
        'id': 'kanto_2',
        'badge_name': 'Medalla Cascada',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/6/60/Medalla_Cascada.png/revision/latest?cb=20120208025705&path-prefix=es',
        'leader_name': 'Misty',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/2/27/VS_Misty.png/revision/latest?cb=20120219224124&path-prefix=es'
    },
    {
        'id': 'kanto_3',
        'badge_name': 'Medalla Trueno',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/e/e6/Medalla_Trueno.png/revision/latest?cb=20120208025844&path-prefix=es',
        'leader_name': 'Lt. Surge',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/a/ad/VS_Lt_Surge.png/revision/latest?cb=20120208030858&path-prefix=es'
    },
    {
        'id': 'kanto_4',
        'badge_name': 'Medalla Arcoiris',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/6/63/Medalla_Arcoiris.png/revision/latest?cb=20120208025704&path-prefix=es',
        'leader_name': 'Erika',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/1/14/VS_Erika.png/revision/latest?cb=20120219225235&path-prefix=es'
    },
    {
        'id': 'kanto_5',
        'badge_name': 'Medalla Alma',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/c/c5/Medalla_Alma.png/revision/latest?cb=20120208025704&path-prefix=es',
        'leader_name': 'Koga',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/b/b9/VS_Koga.png/revision/latest?cb=20120219225846&path-prefix=es'
    },
    {
        'id': 'kanto_6',
        'badge_name': 'Medalla Pantano',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/c/c2/Medalla_Pantano.png/revision/latest?cb=20120208025801&path-prefix=es',
        'leader_name': 'Sabrina',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/7/7a/VS_Sabrina.png/revision/latest?cb=20120219230538&path-prefix=es'
    },
    {
        'id': 'kanto_7',
        'badge_name': 'Medalla Volcan',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/9/93/Medalla_Volc%C3%A1n.png/revision/latest?cb=20120208025845&path-prefix=es',
        'leader_name': 'Blaine',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/7/70/VS_Blaine.png/revision/latest?cb=20120219230945&path-prefix=es'
    },
    {
        'id': 'kanto_8',
        'badge_name': 'Medalla Tierra',
        'badge_url': 'https://static.wikia.nocookie.net/pokecreations/images/1/16/Medalla_Tierra.png/revision/latest?cb=20120208025844&path-prefix=es',
        'leader_name': 'Giovanni',
        'leader_url': 'https://static.wikia.nocookie.net/pokecreations/images/a/a9/VS_Giovanni.png/revision/latest?cb=20120219231605&path-prefix=es'
    }
]

out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gyms')
os.makedirs(out_dir, exist_ok=True)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://pokecreations.fandom.com/es/wiki/Lista_de_medallas_de_Kanto'
}

for it in items:
    stage_id = it['id']
    badge_file = os.path.join(out_dir, f'{stage_id}_badge.png')
    req = urllib.request.Request(it['badge_url'], headers=headers)
    with urllib.request.urlopen(req) as resp:
        with open(badge_file, 'wb') as f:
            f.write(resp.read())
    print(f'Saved {badge_file} ({os.path.getsize(badge_file)} bytes)')

    leader_file = os.path.join(out_dir, f'{stage_id}_leader.png')
    req = urllib.request.Request(it['leader_url'], headers=headers)
    with urllib.request.urlopen(req) as resp:
        with open(leader_file, 'wb') as f:
            f.write(resp.read())
    print(f'Saved {leader_file} ({os.path.getsize(leader_file)} bytes)')

print('All 16 images downloaded successfully!')
