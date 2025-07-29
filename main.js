const { Plugin } = require('obsidian');

class EnhancedTagPlugin extends Plugin {
    async onload() {
        console.log("Plugin: Enhanced Tag Tools loaded");

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection().trim();
                if (!selection) return;

                // --- Пункт 1: Добавить в frontmatter ---
                menu.addItem((item) => {
                    item
                        .setTitle('Add to frontmatter tags')
                        .setIcon('metadata')
                        .onClick(async () => {
                            await this.addToFrontmatter(selection, view);
                        });
                });

                // --- Пункт 2: Создать инлайн-тег (#тег) ---
                menu.addItem((item) => {
                    item
                        .setTitle('Create inline tag from selection')
                        .setIcon('hashtag')
                        .onClick(() => {
                            const tag = this.createTagName(selection);
                            if (!tag) {
                                new Notice('❌ Cannot create tag from selection');
                                return;
                            }
                            editor.replaceSelection(`#${tag}`);
                            new Notice(`✅ Created inline tag: #${tag}`);
                        });
                });
            })
        );
    }

    // --- Функция: добавить в frontmatter ---
    async addToFrontmatter(selection, view) {
        const tag = this.createTagName(selection);
        if (!tag) {
            new Notice('❌ Cannot create tag from selection');
            return;
        }

        const file = view.file;
        if (!file) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        let frontmatterStart = -1;
        let frontmatterEnd = -1;

        if (lines[0] === '---') {
            frontmatterStart = 0;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === '---') {
                    frontmatterEnd = i;
                    break;
                }
            }
        }

        if (frontmatterStart === -1 || frontmatterEnd === -1) {
            lines.splice(0, 0, '---', `tags: [${tag}]`, '---');
            await this.app.vault.modify(file, lines.join('\n'));
            new Notice(`✅ Created frontmatter and added tag: ${tag}`);
            return;
        }

        const fmLines = lines.slice(frontmatterStart + 1, frontmatterEnd);
        const currentTags = new Set();

        let foundTags = false;
        for (let i = 0; i < fmLines.length; i++) {
            const line = fmLines[i].trim();
            if (line.startsWith('tags:')) {
                foundTags = true;
                const after = line.slice(5).trim();
                if (after.startsWith('[')) {
                    const matches = after.slice(1, -1).split(',')
                        .map(t => t.trim().replace(/^['"]|['"]$/g, ''));
                    matches.forEach(t => currentTags.add(t));
                } else if (after) {
                    currentTags.add(after.replace(/^['"]|['"]$/g, ''));
                }
            }
            if (foundTags && line.startsWith('- ')) {
                const t = line.slice(2).trim().replace(/^['"]|['"]$/g, '');
                if (t) currentTags.add(t);
            }
        }

        if (currentTags.has(tag)) {
            new Notice(`✅ Tag "${tag}" already in frontmatter`);
            return;
        }

        currentTags.add(tag);

        const newFmLines = [];
        let tagsInserted = false;

        for (let i = 0; i < fmLines.length; i++) {
            const line = fmLines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('tags:') || (foundTags && trimmed.startsWith('- '))) {
                if (!tagsInserted) {
                    newFmLines.push(`tags: [${Array.from(currentTags).join(', ')}]`);
                    tagsInserted = true;
                }
                continue;
            }

            if (!trimmed.startsWith('- ')) {
                newFmLines.push(line);
            }
        }

        if (!foundTags) {
            newFmLines.unshift(`tags: [${tag}]`);
        } else if (!tagsInserted) {
            newFmLines.unshift(`tags: [${Array.from(currentTags).join(', ')}]`);
        }

        const newContent = [
            '---',
            ...newFmLines,
            '---',
            ...lines.slice(frontmatterEnd + 1)
        ].join('\n');

        await this.app.vault.modify(file, newContent);
        new Notice(`✅ Added tag "${tag}" to frontmatter`);
    }

    // --- Универсальная функция очистки тега (поддержка кириллицы) ---
    createTagName(text) {
        return text
            .toLowerCase()
            .trim()
            .normalize('NFC')
            .replace(/[^a-zа-яё0-9_\-]/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-+/g, '-');
    }

    onunload() {
        console.log("Plugin: Enhanced Tag Tools unloaded");
    }
}

module.exports = EnhancedTagPlugin;