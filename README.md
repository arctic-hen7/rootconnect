# RootConnect

RootConnect is a personal project that makes it painless to capture, maintain, and print detailed family trees. It runs entirely in the browser, so you keep full control of your data while still getting a polished, print-ready layout.

## Live App

Visit https://thebrewery.sh/rootconnect for the hosted build.

## Features

- Build and switch between multiple trees, with every change saved locally in your browser via IndexedDB.
- Add parents, spouses, and children with contextual menus to quickly grow the tree in any direction.
- Edit rich person profiles, including birth and death details, places, and freeform notes.
- Import and export `.gntree` JSON snapshots to share trees or back them up outside the browser.
- Generate a clean SVG layout for printing; the built-in print flow opens a landscape preview that is ready for paper or PDF export.

## Local Development

1. Install Bun if you have not already: https://bun.sh.
2. Run `bun install` to install dependencies.
3. Run `bun run dev` to start the development server at http://localhost:8080 with hot reload.
4. Run `bun run start` for a production-like server that serves the already built assets.

## Usage

1. Open the live app or your local build, then create or select a tree from the left sidebar.
2. Use **Add New Person** to seed the tree; fill out as much detail as you like in the modal editor.
3. Select any person card to reveal contextual actions (edit, add parent, add spouse, delete) and use union nodes to add children to partnerships.
4. Drag the canvas to pan around the tree, use the mouse wheel or trackpad to zoom, and click on empty space to clear selections.
5. Download a full backup at any time with **Save To File**; you can re-import the same `.gntree` file on another device with **Load From File**.

## Printing

- Click the **Print** button in the top toolbar when you are ready to share the tree. The app opens a new window with an SVG layout sized for landscape paper and automatically triggers the browser’s print dialog.
- Save to PDF or send directly to a printer. If the browser blocks pop-ups, RootConnect falls back to downloading the SVG so you can print it manually.
- For best results choose a wide paper size (A3, Tabloid, or Ledger) and disable headers/footers in the print dialog.

## Deployment

1. Run `bun run build` to bundle the app into the `dist/` directory. The build script already sets a public path of `/rootconnect/`, matching the production deployment at thebrewery.sh.
2. Upload the contents of `dist/` to any static host or object storage bucket that supports serving files under the `/rootconnect/` prefix.
3. If you deploy to a different base path, adjust the `--public-path` flag in `package.json` accordingly and rebuild to ensure asset URLs resolve correctly.
