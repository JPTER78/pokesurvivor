"""Shared conversion from official base stats to PokéSurvivor stats."""


def convert(base):
    pa = round(0.70 + base['attack'] / 100 * 0.55, 2)
    sa = round(0.70 + base['special-attack'] / 100 * 0.55, 2)
    return dict(hp=round(70 + base['hp'] * 0.45),
                spd=round(78 + base['speed'] * 0.42), atk=max(pa, sa),
                pa=pa, sa=sa, df=base['defense'], sd=base['special-defense'])
