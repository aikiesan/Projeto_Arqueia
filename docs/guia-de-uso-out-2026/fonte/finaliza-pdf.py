"""Põe título, autor e idioma pt-BR no PDF e comprime os streams.
Uso: python3 finaliza-pdf.py entrada.pdf saida.pdf
"""
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

src, dst = sys.argv[1], sys.argv[2]
r = PdfReader(src)
w = PdfWriter(clone_from=r)
for p in w.pages:
    p.compress_content_streams()
w.add_metadata({
    "/Title": "Guia de uso da Arqueia — outubro de 2026",
    "/Author": "CP2b — Centro Paulista de Estudos em Biogás e Bioprodutos",
    "/Subject": "Guia visual de uso da plataforma Arqueia (cp2b.unicamp.br/arqueia)",
    "/Keywords": "Arqueia, CP2b, Unicamp, agenda, reserva, check-in, QR, informes",
    "/Creator": "deck.html + Chromium (Playwright)",
})
w._root_object[NameObject("/Lang")] = TextStringObject("pt-BR")
w.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
with open(dst, "wb") as f:
    w.write(f)
print(dst, len(w.pages), "páginas")
