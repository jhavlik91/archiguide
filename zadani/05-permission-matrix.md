# Permission Matrix

Legenda:
- Y = povoleno
- C = podmíněně
- N = nepovoleno

| Akce | Návštěvník | B2C klient | B2B klient | Profesionál | Firma admin | Firma editor | Moderátor | Admin |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Prohlížet veřejné profily | Y | Y | Y | Y | Y | Y | Y | Y |
| Začít guide | Y | Y | Y | Y | Y | Y | Y | Y |
| Uložit guide | C | Y | Y | Y | Y | Y | N | Y |
| Vytvořit brief | C | Y | Y | Y | Y | Y | N | Y |
| Publikovat B2C poptávku | N | Y | C | C | C | C | N | Y |
| Publikovat B2B poptávku | N | C | Y | Y | Y | C | N | Y |
| Reagovat na poptávku | N | C | C | Y | Y | C | N | Y |
| Vytvořit profesionální profil | N | N | C | Y | C | N | N | Y |
| Vytvořit firmu | N | C | Y | Y | Y | N | N | Y |
| Spravovat členy firmy | N | N | C | N | Y | N | N | Y |
| Editovat firemní profil | N | N | C | N | Y | Y | N | Y |
| Publikovat portfolio | N | N | C | Y | Y | C | N | Y |
| Psát zprávy | N | Y | Y | Y | Y | Y | C | Y |
| Číst cizí zprávy | N | N | N | N | N | N | C | C |
| Vytvořit recenzi | N | C | C | C | C | C | N | Y |
| Moderovat recenzi | N | N | N | N | N | N | Y | Y |
| Ověřit kvalifikaci | N | N | N | N | N | N | C | Y |
| Spravovat monetizaci | N | N | N | N | N | N | N | Y |

## Doplňující pravidla

### Multi-role
Jeden účet může mít více rolí. Oprávnění se vyhodnocují v aktuálním kontextu.

### Firma
Firemní role:
- Owner
- Admin
- Editor
- Recruiter
- Sales
- Member

### Projektová místnost
Role:
- Project owner
- Client
- Lead professional
- Professional
- Contractor
- Viewer

### Citlivé akce
Následující akce vyžadují explicitní potvrzení:
- zveřejnění přesné adresy,
- zveřejnění citlivé přílohy,
- převod vlastnictví firmy,
- smazání projektu,
- publikace identity u anonymizované poptávky.
