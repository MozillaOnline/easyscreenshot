Chaz.init("popup.privileged");
const Background = new Chaz("background");
const Content = new Chaz("page.content");
const Action = {
    select() {
        Content.send("select");
    },
    entire() {
        Background.send("entire");
    },
    visible() {
        Background.send("visible");
    },
    feedback() {
        Background.send("open", {
            url: browser.i18n.getMessage("feedbackUrl"),
        });
    },
};


document.getElementById("run-screenshot").addEventListener("click", function(e) {
    var elt = e.target;
    while (elt && !(elt.dataset && elt.dataset.screenshot)) {
        elt = elt.parentNode;
    }
    if (!elt) return;
    if (!Action[elt.dataset.screenshot]) {
        throw new Error(`${elt.dataset.screenshot} is not in Action`);
    }
    Action[elt.dataset.screenshot]();
    window.close();
});


Array.from(
    document.querySelectorAll("[chaz-i18n]")
).forEach(function(elt) {
    elt.textContent = browser.i18n.getMessage(
        elt.getAttribute("chaz-i18n")
    );
});
