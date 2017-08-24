/* global Content, Editor */

/** capture action launcher*/
class PrintScreenLauncher {
    static async entire() {
        var activeTabId = await Chaz.Utility.getActivatedTabId();
        var imgInfo = await Content.send("entire", null, activeTabId);
        await PrintScreenLauncher.openEditor(imgInfo);
    }
    static async visible() {
        var activeTabId = await Chaz.Utility.getActivatedTabId();
        var imgInfo = await Content.send("visible", null, activeTabId);
        await PrintScreenLauncher.openEditor(imgInfo);
    }
    static async openEditor(imgInf) {
        await browser.tabs.create({
            url: browser.extension.getURL("editor/editor.html"),
            active: true,
        });
        Editor.one("fetch", () => imgInf);
    }
}
