# Inlines the screening code into the page: python3 build.py
import pathlib
page = pathlib.Path('src/index.src.html').read_text().replace('/*SCREEN*/', pathlib.Path('src/screen.js').read_text())
pathlib.Path('index.html').write_text(page); print('index.html', len(page), 'bytes')
