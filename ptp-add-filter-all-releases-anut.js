// ==UserScript==
// @name         PTP - Add releases from other trackers - other
// @namespace    https://github.com/Audionut
// @version      1.2.2
// @updateURL    https://raw.githubusercontent.com/Audionut/add-trackers/main/ptp-add-filter-all-releases-anut.js
// @downloadURL  https://raw.githubusercontent.com/Audionut/add-trackers/main/ptp-add-filter-all-releases-anut.js
// @description  add releases from other trackers
// @author       passthepopcorn_cc (edited by Perilune + Audionut)
// @match        https://passthepopcorn.me/torrents.php?id=*
// @icon         https://passthepopcorn.me/favicon.ico
// @grant        GM_xmlhttpRequest
// ==/UserScript==
// test update function
(function () {
    "use strict";

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////                                   USER OPTIONS                     ////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //  available trackers: "BHD", "CG", "FL", "HDB", "KG", "PTP", "MTV", "ANT", "BLU"*, "TIK"*, "HUNO", "Aither"*, "RFX"*, "OE"*, "AvistaZ"**, "CinemaZ"**, "PHD"**
    //  available tv_trackers: "BTN", "NBL", "TVV" - not quite yet
    //  if you don't need the results from some of these trackers, do not add them. the fewer you add, the faster the code execution.
    //  *requires API key     **performs two requests
    const trackers = ["PTP", "MTV", "ANT", "HUNO"];

    const BLU_API_TOKEN = ""; // if you want to use BLU - find your api key here: https://blutopia.cc/users/YOUR_USERNAME_HERE/apikeys
    const TIK_API_TOKEN = ""; // if you want to use TIK - find your api key here: https://cinematik.net/users/YOUR_USERNAME_HERE/apikeys
    const AITHER_API_TOKEN = ""; // if you want to use Aither - find your api key here: https:/aither.cc/users/YOUR_USERNAME_HERE/apikeys
    const HUNO_API_TOKEN = ""; // if you want to use HUNO - find your api key here: https://hawke.uno/users/YOUR_USERNAME_HERE/settings/security#api
    const RFX_API_TOKEN = ""; // if you want to use RFX - find your api key here: https:/reelflix.xyz/users/YOUR_USERNAME_HERE/apikeys
    const OE_API_TOKEN = ""; /// if you want to use OE - find your api key here: https:/onlyencodes.cc/users/YOUR_USERNAME_HERE/apikeys

    const hide_blank_links = true; // false = will also create blank [PL] [RP] links ||| true = will only show [DL] link
    const show_tracker_icon = true; // false = will show default green checked icon ||| true = will show tracker logo instead of checked icon
    const show_tracker_name = true; // false = will hide tracker name ||| true = will show tracker name
    const hide_if_torrent_with_same_size_exists = false; // true = will hide torrents with the same file size as existing PTP ones
    const log_torrents_with_same_size = false; // true = will log torrents with the same file size as existing PTP ones in console (F12)
    const hide_filters_div = false; // false = will show filters box ||| true = will hide filters box
    const show_only_ptp_by_default = false; // false = will show all torrents by default, including external ones ||| true = will only show PTP torrents by default
    const hide_dead_external_torrents = false; // true = won't display dead external torrents
    const open_in_new_tab = true; // false : when you click external torrent, it will open the page in new tab. ||| true : it will replace current tab.
    //const include_miniseries = false; // true : will also search tv_trackers added above ||| false : don't search the tv_trackers when it's a miniseries.

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let discounts = ["Freeleech", "75% Freeleech", "50% Freeleech", "25% Freeleech", "Refundable", "Rewind", "Rescuable", "None"];
    let qualities = ["SD", "480p", "576p", "720p", "1080p", "2160p"];
    let filters = {
        "trackers": trackers.map((e) => {
            return ({ "name": e, "status": "default" });
        }),

        "discounts": discounts.map((e) => {
            return ({ "name": e, "status": "default" });
        }),

        "qualities": qualities.map((e) => {
            return ({ "name": e, "status": "default" });
        }),
    };
    let doms = [];
    const TIMEOUT_DURATION = 10000;


    const dom_get_quality = (text) => {
        if (text.includes("720p")) return "720p";
        else if (text.includes("1080p")) return "1080p";
        else if (text.includes("2160p")) return "2160p";
        else if (text.includes("576p")) return "576p";
        else if (text.includes("480p")) return "480p";
        else return "SD";
    };


    const get_default_doms = () => {
        [...document.querySelectorAll("tr.group_torrent_header")].forEach((d, i) => {
            let tracker = "PTP";
            let dom_path = d;
            let quality = dom_get_quality(d.textContent);
            let discount = "None";
            let info_text = d.textContent;
            let seeders = parseInt(d.querySelector("td:nth-child(4)").textContent.replace(",", ""));
            let leechers = parseInt(d.querySelector("td:nth-child(5)").textContent.replace(",", ""));
            let snatchers = parseInt(d.querySelector("td:nth-child(3)").textContent.replace(",", ""));
            let size = d.querySelector("td:nth-child(2)").textContent.trim();

            if (size.includes("GiB")) size = (parseFloat(size.split(" ")[0]) * 1024).toFixed(2);
            else if (size.includes("MiB")) size = (parseFloat(size.split(" ")[0])).toFixed(2);
            else size = 1;

            let dom_id = "ptp_" + i;

            d.className += " " + dom_id; // required for re-render, nice fix

            doms.push({ tracker, dom_path, quality, discount, info_text, seeders, leechers, snatchers, dom_id, size });
        });
    };


    get_default_doms();

    const is_it_miniseries = () => {
        if ([...document.querySelectorAll("span.basic-movie-list__torrent-edition__main")].some(d => d.textContent.includes("Miniseries"))) {
                return "Miniseries";
            } else {
                return "Not included";
            }
    };

    function insertAfter(newNode, referenceNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }


    const get_discount_text = (div, tracker) => {
        if (tracker === "HDB") {
            if (div.querySelector("b > a").title.includes("50% Free Leech")) return "50% Freeleech";
            else if (div.querySelector("b > a").title.includes("25% Free Leech")) return "25% Freeleech";
            else if (div.querySelector("b > a").title.includes("Neutral Leech")) return "Neutral Leech";
            else if (div.querySelector("b > a").title.includes("100% FL")) return "Freeleech";
        }
        else if (tracker === "BHD") {
            if (div.querySelector("i.fa-peace") != null) return "Freeleech"; // limited FL, with 1.0 upload cap.
            else if (div.querySelector("i.fa-popcorn") != null) return "Rewind"; // limited FL, until there are enough seeders?
            else if (div.querySelector("i.text-refund") != null) return "Refundable";
            else if (div.querySelector("i.fa-life-ring") != null) return "Rescuable"; // limited FL, until there are enough seeders=
            else { // eğer fl varsa
                let discount = [...div.querySelectorAll("i.fa-star")].find(i => {
                    return (
                        i.getAttribute("title") != null &&
                        i.getAttribute("title").includes("Free")
                    );
                });
                //[...div.querySelectorAll("i.fa-star")].forEach(a => console.log(a));
                if (discount === undefined) return "None";
                else {
                    let discount_value = discount.getAttribute("title").split(" ")[0]; // returns 50%
                    if (discount_value === "100%") return "Freeleech";
                    else return discount_value + " Freeleech";
                }
            }
        }
        else if (["BLU", "Aither", "RFX", "OE", "TIK", "HUNO"].includes(tracker)) {
            return true;
        }
        else if (tracker === "FL") {
            if ([...div.querySelectorAll("img")].find(e => e.alt === "FreeLeech") != undefined) return "Freeleech";
        }
        else if (tracker === "MTV") {
            if ([...div.querySelectorAll("img")].find(e => e.alt === "FreeLeech") != undefined) return "Freeleech";
        }
        else if (tracker === "ANT") {
          const freeleechLabels = div.querySelectorAll("strong.torrent_label.tooltip.tl_free");
          if (freeleechLabels.length > 0) {
            for (const label of freeleechLabels) {
              if (label.textContent.includes("FreeLeech")) {
                return "Freeleech";
              }
            }
          }
        }
        else if (tracker === "CG") {
            if ([...div.querySelectorAll("img")].find(e => e.alt === "100% bonus") != undefined) return "Freeleech";
        }
        else if (["AvistaZ", "CinemaZ", "PHD"].includes(tracker)) {
            const icons = div.querySelectorAll(".torrent-file > div > i");
            if (icons.length > 0) {
                let discount = "";
                let text;
                for (let [i, icon] of icons.entries()) {
                    if (icon.title === "Free Download") {
                        text = "Freeleech";
                    } else if (icon.title === "Half Download") {
                        text = "50% Freeleech";
                    } else if (icon.title === "Double upload") {
                        text = "Double Upload";
                    } else {
                        text = icon.title;
                    }
                    discount += text + (icons.length > 0 && i < icons.length - 1 ? " / " : "");
                }
                return text;
            }
        }
        return "None";
    };


    const get_tracker_icon = (tracker) => {
        if (tracker === "BHD") return "https://beyond-hd.me/favicon.ico";
        else if (tracker === "BLU") return "https://blutopia.cc/favicon.ico";
        else if (tracker === "Aither") return "https://aither.cc/favicon.ico";
        else if (tracker === "RFX") return "https://reelflix.xyz/favicon.ico";
        else if (tracker === "OE") return "https://onlyencodes.cc/favicon.ico";
        else if (tracker === "CG") return "https://cinemageddon.net/favicon.ico";
        else if (tracker === "FL") return "https://filelist.io/favicon.ico";
        else if (tracker === "AvistaZ") return "https://avistaz.to/images/avistaz-favicon.png";
        else if (tracker === "PHD") return "https://privatehd.to/images/privatehd-favicon.png";
        else if (tracker === "CinemaZ") return "https://cinemaz.to/images/cinemaz-favicon.png";
        else if (tracker === "HDB") return "https://hdbits.org/pic/favicon/favicon.ico";
        else if (tracker === "KG") return "https://karagarga.in/favicon.ico";
        else if (tracker === "TIK") return "https://cinematik.net/favicon.ico";
	else if (tracker === "MTV") return "https://www.morethantv.me/favicon.ico";
	else if (tracker === "ANT") return "https://anthelion.me/favicon.ico";
	else if (tracker === "RTF") return "https://retroflix.club/favicon.ico";
	else if (tracker === "HUNO") return "https://hawke.uno/favicon.ico";
        //else if (tracker === "BTN") return "https://broadcasthe.net/favicon.ico";
    };


    const use_api_instead = (tracker) => {
        if (
            (tracker === "BLU") ||
            (tracker === "Aither") ||
            (tracker === "RFX") ||
            (tracker === "OE") ||
            (tracker === "HUNO") ||
            (tracker === "TIK")
        )
            return true;
        else return false;
    };


    const get_torrent_objs = async (tracker, html) => {
        let torrent_objs = [];

        if (tracker === "HDB") {
            html.querySelector("#torrent-list > tbody").querySelectorAll("tr").forEach((d) => {
                let torrent_obj = {};
                let size = d.querySelectorAll("td")[5].textContent;

                if (size.includes("GiB")) {
                    size = parseInt(parseFloat(size.split("GiB")[0]) * 1024); // MB
                }
                else if (size.includes("MiB")) size = parseInt(parseFloat(size.split("MiB")[0]));

                torrent_obj.size = size;
                torrent_obj.info_text = d.querySelector("td:nth-child(3) > b > a").textContent;
                torrent_obj.site = "HDB";
                torrent_obj.download_link = d.querySelector(".js-download").href.replace("passthepopcorn.me", "hdbits.org");
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(9)").textContent);
                torrent_obj.torrent_page = [...d.querySelectorAll("a")].find(a => a.href.includes("/details.php?id=")).href.replace("passthepopcorn.me", "hdbits.org");
                torrent_obj.status = d.querySelectorAll("span.tag_seeding").length > 0 ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_obj.internal = d.querySelector(".tag.internal") ? true : false;
                torrent_obj.exclusive = d.querySelector(".tag.exclusive") ? true : false;
                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "MTV") {
            // Handling for MTV tracker
            html.querySelector("#torrent_table > tbody").querySelectorAll("tr:not(.colhead)").forEach((d) => {
                let torrent_obj = {};
                let size = d.querySelectorAll("td")[4].textContent;

                if (size.includes("GiB")) {
                    size = parseInt(parseFloat(size.split("GiB")[0]) * 1024); // MB
                }
                else if (size.includes("MiB")) size = parseInt(parseFloat(size.split("MiB")[0]));
                // Extracting data
                torrent_obj.size = size;
                const infoText = d.querySelector("a.overlay_torrent").textContent;
                const modifiedInfoText = infoText.replace(/\./g, ' ');
                const isInternal = modifiedInfoText.includes("-hallowed") || modifiedInfoText.includes("-TEPES") || modifiedInfoText.includes("-END") || modifiedInfoText.includes("-WDYM");
                torrent_obj.info_text = modifiedInfoText;
                torrent_obj.site = "MTV";
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("torrents.php?action=")).href.replace("passthepopcorn.me", "morethantv.me");
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(6)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.torrent_page = [...d.querySelectorAll("a.overlay_torrent")].find(a => a.href.includes("/torrents.php?id=")).href.replace("passthepopcorn.me", "morethantv.me");
                //torrent_obj.status = "default"; // You need to extract status from the HTML
                //torrent_obj.discount = ""; // You need to extract discount from the HTML
                torrent_obj.internal = isInternal ? true : false;
                //torrent_obj.exclusive = false; // You need to extract exclusive status from the HTML

                torrent_objs.push(torrent_obj);
            });
        }
        else if (include_miniseries && tracker === "BTN") {
            // Fetch the redirected URL
            fetch(response.url)
                .then(response => response.text())
                .then(htmlText => {
                    // Parse the HTML text to create a new HTML document
                    const newHtml = new DOMParser().parseFromString(htmlText, 'text/html');

            // Use querySelectorAll on the new HTML document
            newHtml.querySelectorALL("tr.group_torrent.discog").forEach((d) => {
                let torrent_obj = {};
                let size = d.querySelectorAll("td")[1].textContent;

                if (size.includes("GB")) {
                    size = parseInt(parseFloat(size.split("GB")[0]) * 1024); // MB
                }
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split("MB")[0]));
                // Extracting data
                torrent_obj.size = size;
                const infoText = d.querySelector("tr.group_torrent discog > td > a").textContent;
                const modifiedInfoText = infoText.replace(/\//g, '');
                //const isInternal = modifiedInfoText.includes("-hallowed") || modifiedInfoText.includes("-TEPES") || modifiedInfoText.includes("-END") || modifiedInfoText.includes("-WDYM");
                torrent_obj.info_text = modifiedInfoText;
                torrent_obj.site = "BTN";
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("torrents.php?action=")).href.replace("passthepopcorn.me", "broadcasthe.net");
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(3)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(4)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(5)").textContent);
                //torrent_obj.torrent_page = [...d.querySelectorAll("a.overlay_torrent")].find(a => a.href.includes("/torrents.php?id=")).href.replace("passthepopcorn.me", "broadcasthe.net");
                //torrent_obj.status = "default"; // You need to extract status from the HTML
                //torrent_obj.discount = ""; // You need to extract discount from the HTML
                //torrent_obj.internal = isInternal ? true : false;
                //torrent_obj.exclusive = false; // You need to extract exclusive status from the HTML

                torrent_objs.push(torrent_obj);
            });
            });
        }
        else if (tracker === "ANT") {
            try {
                // Handling for ANT tracker
                const rows = html.querySelector(".torrent_table#torrent_details > tbody").querySelectorAll("tr:not(.colhead_dark):not(.sortGroup)").forEach((d) => {;
                    console.log("Inside ANT forEach loop"); // Add this check
                    try {
                        let torrent_obj = {};
                        let size = d.querySelectorAll("td")[1].textContent;
                        try {
                            if (size.includes("GiB")) {
                                size = parseInt(parseFloat(size.split("GiB")[0]) * 1024); // MB
                            } else if (size.includes("MiB")) {
                                size = parseInt(parseFloat(size.split("MiB")[0]));
                            }
                        } catch (error) {
                            console.error("Error parsing size:", error); // Add this check
                            size = null; // Set size to null in case of error
                        }

                        // Extracting data
                        torrent_obj.size = size;
                        torrent_obj.info_text = d.querySelector("td:nth-child(1) > a").textContent.replace(/\//g, '');
                        torrent_obj.site = "ANT";
                        torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("torrents.php?action=") && !a.href.includes("&usetoken=1")).href.replace("passthepopcorn.me", "anthelion.me");
                        torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(3)").textContent);
                        torrent_obj.seed = parseInt(d.querySelector("td:nth-child(4)").textContent);
                        torrent_obj.leech = parseInt(d.querySelector("td:nth-child(5)").textContent);
                        //torrent_obj.torrent_page = "https://anthelion.me/torrents.php?searchstr=" + imdb_id +"&order_by=time&order_way=desc&group_results=1&action=basic&searchsubmit=1"
                        //torrent_obj.status = "default"; // You need to extract status from the HTML
                        //torrent_obj.discount = ""; // You need to extract discount from the HTML
                        //torrent_obj.internal = false; // You need to extract internal status from the HTML
                        //torrent_obj.exclusive = false; // You need to extract exclusive status from the HTML

                        torrent_objs.push(torrent_obj);
                    } catch (error) {
                        console.error("Error inside ANT forEach loop:", error); // Add this check
                    }
                });
            } catch (error) {
                console.error("Error in ANT section:", error); // Add this check
            }
        }
        else if (tracker === "RTF") {
            // Handling for MTV tracker
            html.querySelector(".col-12").querySelectorAll("row pt-2 pb-2").forEach((d) => {
                let torrent_obj = {};
                //let size = d.querySelectorAll('.text-center').textContent;

                //if (size.includes("GB")) {
                //    size = parseInt(parseFloat(size.split("GB")[0]) * 1024); // MB
                //}
                //else if (size.includes("MB")) size = parseInt(parseFloat(size.split("MB")[0]));
                //console.log(size);
                let elements = d.querySelectorAll('.text-center');
                let size = 0;

                elements.forEach(element => {
                    let text = element.textContent;

                    if (text.includes("GB")) {
                      size = parseInt(parseFloat(text.split("GB")[0]) * 1024); // Convert GB to MB
                    } else if (text.includes("MB")) {
                      size = parseInt(parseFloat(text.split("MB")[0])); // Extract the size in MB
                    }
                });
                console.log(size);
                // Extracting data
                torrent_obj.size = size;
                torrent_obj.info_text = d.querySelector(".font-weight-bold").textContent;
                torrent_obj.site = "MTV";
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("/download.php?id=")).href.replace("passthepopcorn.me", "retroflix.club");
                torrent_obj.snatch = parseInt(d.querySelectorALL(".text-success").textContent);
                torrent_obj.seed = parseInt(d.querySelectorALL(".text-success").textContent);
                torrent_obj.leech = parseInt(d.querySelectorALL(".text-muted").textContent);
                //torrent_obj.torrent_page = [...d.querySelectorAll("a.overlay_torrent")].find(a => a.href.includes("/torrents.php?id=")).href.replace("passthepopcorn.me", "retroflix.club");
                //torrent_obj.status = "default"; // You need to extract status from the HTML
                //torrent_obj.discount = ""; // You need to extract discount from the HTML
                //torrent_obj.internal = false; // You need to extract internal status from the HTML
                //torrent_obj.exclusive = false; // You need to extract exclusive status from the HTML

                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "BHD") {
            [...html.querySelector(".table-new").querySelectorAll("tr.bhd-sub-header-compact")].filter(e => !["Extras", "Specials"].includes(e.textContent.trim())).forEach((d) => {
                let torrent_obj = {};
                let size = [...d.querySelectorAll("td")].find(e => e.textContent.includes(" GiB") || e.textContent.includes(" MiB")).textContent.trim();

                if (size.includes("GiB")) {
                    size = parseInt(parseFloat(size.split(" ")[0]) * 1024); // MB
                }
                else if (size.includes("MiB")) size = parseInt(parseFloat(size.split(" ")[0]));

                torrent_obj.size = size;
                torrent_obj.info_text = d.querySelector("a.text-compact").textContent.trim();
                torrent_obj.site = "BHD";
                torrent_obj.snatch = d.querySelector("a.torrent-completes").textContent.trim();
                torrent_obj.seed = d.querySelector("a.torrent-seeders").textContent.trim();
                torrent_obj.leech = d.querySelector("a.torrent-leechers").textContent.trim();
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => {
                    return a.title === "Download Torrent";
                }).href;
                torrent_obj.torrent_page = d.querySelector("a").href;
                torrent_obj.status = d.querySelectorAll("i.fa-seedling").length > 0 ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);

                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "FL") {
            html.querySelectorAll(".torrentrow").forEach((d) => {
                let torrent_obj = {};
                let size = [...d.querySelectorAll("font")].find((d) => {
                    return (d.textContent.includes("[") === false) && (d.textContent.includes("GB") || d.textContent.includes("MB"));
                }).textContent;

                if (size.includes("GB")) {
                    size = parseInt(parseFloat(size.split("GB")[0]) * 1024); // MB
                }
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split("MB")[0]));

                torrent_obj.size = size;
                torrent_obj.info_text = [...d.querySelectorAll("a")].find(a => a.href.includes("details.php?id=")).title.replace(/\./g, " ");
                torrent_obj.site = "FL";
                torrent_obj.snatch = parseInt(d.querySelector("div:nth-child(8)").textContent.replace(/,/g, ""));
                torrent_obj.seed = parseInt(d.querySelector("div:nth-child(9)").textContent.replace(/,/g, ""));
                torrent_obj.leech = parseInt(d.querySelector("div:nth-child(10)").textContent.replace(/,/g, ""));
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("download.php?id=")).href.replace("passthepopcorn.me", "filelist.io");
                torrent_obj.torrent_page = [...d.querySelectorAll("a")].find(a => a.href.includes("/details.php?id=")).href.replace("passthepopcorn.me", "filelist.io");
                torrent_obj.status = "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "CG") {
            let ar1 = [...html.querySelectorAll("tr.prim")];
            let ar2 = [...html.querySelectorAll("tr.sec")];
            let ar3 = [...html.querySelectorAll("tr.torrenttable_usersnatched")];

            let combined_arr = ar1.concat(ar2).concat(ar3);

            combined_arr.forEach((d) => {
                let torrent_obj = {};

                let size = d.querySelector("td:nth-child(5)").textContent;

                if (size.includes("GB")) {
                    size = parseInt(parseFloat(size.split(" ")[0]) * 1024); // MB
                }
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split(" ")[0]));
                else size = 1; // must be kiloBytes, so lets assume 1mb.

                torrent_obj.size = size;
                torrent_obj.info_text = d.querySelectorAll("td")[1].querySelector("b").textContent.trim();
                torrent_obj.site = "CG";
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(6)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("download.php?id=")).href.replace("passthepopcorn.me", "cinemageddon.net");
                torrent_obj.torrent_page = [...d.querySelectorAll("a")].find(a => a.href.includes("/details.php?id=")).href.replace("passthepopcorn.me", "cinemageddon.net");
                torrent_obj.status = d.className.includes("torrenttable_usersnatched") ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "KG") {
            html.querySelector("#browse > tbody").querySelectorAll("tr").forEach((d) => {
                try {
                    let torrent_obj = {};
                    let size = d.querySelector("td:nth-child(11)").textContent.replace(",", "");

                    if (size.includes("GB")) {
                        size = parseInt(parseFloat(size.split("GB")[0]) * 1024); // MB
                    }
                    else if (size.includes("MB")) size = parseInt(parseFloat(size.split("MB")[0]));
                    else size = 1; // must be kiloBytes, so lets assume 1mb.

                    const images = d.querySelectorAll("[style='position:absolute;top:0px; left:0px'] > img");
                    torrent_obj.quality = Array.from(images).some(img => img.title.includes("HD")) ? "HD" : "SD";
                    torrent_obj.size = size;
                    torrent_obj.info_text = d.querySelectorAll("td")[1].querySelector("a").textContent.trim();
                    torrent_obj.site = "KG";
                    torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(12)").textContent);
                    torrent_obj.seed = parseInt(d.querySelector("td:nth-child(13)").textContent);
                    torrent_obj.leech = parseInt(d.querySelector("td:nth-child(14)").textContent);
                    torrent_obj.download_link = [...d.querySelectorAll("a")].find(a => a.href.includes("/down.php/")).href.replace("passthepopcorn.me", "karagarga.in");
                    torrent_obj.torrent_page = [...d.querySelectorAll("a")].find(a => a.href.includes("/details.php?id=")).href.replace("passthepopcorn.me", "karagarga.in");
                    torrent_obj.status = d.className.includes("snatchedrow") ? "seeding" : "default";
                    torrent_obj.discount = get_discount_text(d, tracker);
                    torrent_objs.push(torrent_obj);
                } catch (e) {
                    console.error("An error has occurred: ", e);
                }
            });
        }
        else if (tracker === "AvistaZ") {
            // requires another request to get to the torrents
            const groupUrl = html.querySelector("h3.movie-title > a").href;
            const groupId = groupUrl.match(/\/movie\/(\d+)-/)[1];
            const url = `https://avistaz.to/movies/torrents/${groupId}?quality=all`;
            const result = await fetch_url(url);

            result.querySelectorAll("tbody > tr").forEach(d => {
                let torrent_obj = {};
                let size = d.querySelector("td:nth-child(5)").textContent.trim().replace(",", "");

                if (size.includes("GB")) size = parseInt(parseFloat(size.split(" ")[0]) * 1024); // MB
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split(" ")[0]));
                else size = 1;

                const torrentLink = d.querySelector(".torrent-file > div > a");
                torrent_obj.size = size;
                torrent_obj.info_text = torrentLink.textContent.trim();
                torrent_obj.site = "AvistaZ";
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(6)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.download_link = d.querySelector(".torrent-download-icon").href.replace("passthepopcorn.me", "avistaz.to");
                torrent_obj.torrent_page = torrentLink.href.replace("passthepopcorn.me", "avistaz.to");
                torrent_obj.status = d.className.includes("success") ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "CinemaZ") {
            // requires another request to get to the torrents
            const groupUrl = html.querySelector("h3.movie-title > a").href;
            const groupId = groupUrl.match(/\/movie\/(\d+)-/)[1];
            const url = `https://cinemaz.to/movies/torrents/${groupId}?quality=all`;
            const result = await fetch_url(url);

            result.querySelectorAll("tbody > tr").forEach(d => {
                let torrent_obj = {};
                let size = d.querySelector("td:nth-child(5)").textContent.trim().replace(",", "");

                if (size.includes("GB")) size = parseInt(parseFloat(size.split(" ")[0]) * 1024); // MB
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split(" ")[0]));
                else size = 1;

                const torrentLink = d.querySelector(".torrent-file > div > a");
                torrent_obj.size = size;
                torrent_obj.info_text = torrentLink.textContent.trim();
                torrent_obj.site = "CinemaZ";
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(6)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.download_link = d.querySelector(".torrent-download-icon").href.replace("passthepopcorn.me", "cinemaz.to");
                torrent_obj.torrent_page = torrentLink.href.replace("passthepopcorn.me", "cinemaz.to");
                torrent_obj.status = d.className.includes("success") ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_objs.push(torrent_obj);
            });
        }
        else if (tracker === "PHD") {
            // requires another request to get to the torrents
            const groupUrl = html.querySelector("h3.movie-title > a").href;
            const groupId = groupUrl.match(/\/movie\/(\d+)-/)[1];
            const url = `https://privatehd.to/movies/torrents/${groupId}?quality=all`;
            const result = await fetch_url(url);

            result.querySelectorAll("tbody > tr").forEach(d => {
                let torrent_obj = {};
                let size = d.querySelector("td:nth-child(5)").textContent.trim().replace(",", "");

                if (size.includes("GB")) size = parseInt(parseFloat(size.split(" ")[0]) * 1024); // MB
                else if (size.includes("MB")) size = parseInt(parseFloat(size.split(" ")[0]));
                else size = 1;

                const torrentLink = d.querySelector(".torrent-file > div > a");
                torrent_obj.size = size;
                torrent_obj.info_text = torrentLink.textContent.trim();
                torrent_obj.site = "PHD";
                torrent_obj.snatch = parseInt(d.querySelector("td:nth-child(8)").textContent);
                torrent_obj.seed = parseInt(d.querySelector("td:nth-child(6)").textContent);
                torrent_obj.leech = parseInt(d.querySelector("td:nth-child(7)").textContent);
                torrent_obj.download_link = d.querySelector(".torrent-download-icon").href.replace("passthepopcorn.me", "privatehd.to");
                torrent_obj.torrent_page = torrentLink.href.replace("passthepopcorn.me", "privatehd.to");
                torrent_obj.status = d.className.includes("success") ? "seeding" : "default";
                torrent_obj.discount = get_discount_text(d, tracker);
                torrent_objs.push(torrent_obj);
            });
        }
        torrent_objs = torrent_objs.map(e => {
            return { ...e, "quality": get_torrent_quality(e) };
        });

        return torrent_objs;
    };


    const is_movie_exist = (tracker, html) => { // true or false
        if (tracker === "PTP") {
            if (html.querySelector("#no_results_message > div") === null) return true;
            else return false;
        }
        else if (tracker === "HDB") {
            if (html.querySelector("#resultsarea").textContent.includes("Nothing here!")) return false;
            else return true;
        }
        else if (tracker === "MTV") {
            if (html.querySelector(".numsearchresults").textContent.includes("0 results")) return false;
            else return true;
        }
        else if (tracker === "BTN") {
            if (html.querySelector(".thin").textContent.includes("Error")) return false;
            else return true;
        }
        else if (tracker === "ANT") {
            if (html.querySelector(".head").textContent.includes("Basic Search (")) return false;
            else return true;
        }
        else if (tracker === "RTF") {
            if (html.querySelector(".col-md-12").textContent.includes("No results found.")) return false;
            else return true;
        }
        else if (tracker === "BHD") {
            if (html.querySelectorAll(".bhd-meta-box").length === 0) return false;
            else return true;
        } else if (tracker === "BLU" || tracker === "Aither" || tracker === "RFX" || tracker === "OE" || tracker === "HUNO" || tracker === "TIK") {
            if (html.querySelector(".torrent-search--list__no-result") === null) return true;
            else return false;
        }
        else if (["AvistaZ", "CinemaZ", "PHD"].includes(tracker)) {
            if (html.querySelector("#content-area > div.block > p") === null) return true;
            else return false;
        }
        else if (tracker === "FL") {
            if (html.querySelectorAll(".torrentrow").length === 0) return false;
            else return true;
        }
        else if (tracker === "CG") {
            let ar1 = [...html.querySelectorAll("tr.prim")];
            let ar2 = [...html.querySelectorAll("tr.even")];
            let ar3 = [...html.querySelectorAll("tr.torrenttable_usersnatched")];

            let combined_arr = ar1.concat(ar2).concat(ar3);

            if (combined_arr.length > 0) return true; // it's different, pay attention !
            else return false;
        }
        else if (tracker === "KG") {
            if (html.querySelector("tr.oddrow") === null) return false; // it's different, pay attention !
            else return true;
        }
    };

    const fetch_url = async (query_url) => {
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url: query_url,
                    method: "GET",
                    timeout: TIMEOUT_DURATION,
                    onload: resolve,
                    onerror: reject,
                    onabort: reject,
                    ontimeout: reject,
                });
            });

            if (response.status === 200) {
                const parser = new DOMParser();
                const result = parser.parseFromString(response.responseText, "text/html").body;
                return result;
            } else {
                console.error(`Error: HTTP ${response.status} Error.`);
                throw new Error(`HTTP ${response.status} Error`);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
            throw error;
        }
    };


    const fetch_tracker = async (tracker, imdb_id) => {
        return new Promise((resolve, reject) => {
            let query_url = "";
            let api_query_url = "";

            if (tracker === "PTP") {
                query_url = "https://passthepopcorn.me/torrents.php?imdb=" + imdb_id;
            }
            else if (tracker === "HDB") {
                //query_url = "https://hdbits.org/browse.php?c3=1&c1=1&c2=1&tagsearchtype=or&imdb=" + mov.imdb_id + "&sort=size&h=8&d=DESC"
                query_url = "https://hdbits.org/browse.php?c3=1&c8=1&c1=1&c4=1&c5=1&c2=1&c7=1&descriptions=0&season_packs=0&from=&to=&imdbgt=0&imdblt=10&imdb=" + imdb_id + "&sort=size&h=8&d=DESC";
            }
            else if (tracker === "MTV") {
                query_url = "https://www.morethantv.me/torrents/browse?page=1&order_by=time&order_way=desc&=Search&=Reset&=Search&searchtext=" + imdb_id + "&action=advanced&title=&sizeall=&sizetype=kb&sizerange=0.01&filelist=&autocomplete_toggle=on";
            }
            else if (tracker === "BTN") {
                query_url = "https://broadcasthe.net/torrents.php?action=advanced&imdb=" + imdb_id;
                // Perform the HTTP request to the BTN advanced search page
                fetch(query_url)
                    .then(response => {
                        // Check if the response indicates a successful redirection
                        if (response.redirected) {
                            // Redirected, so wait for the new page to load
                            return fetch(response.url);
                        } else {
                            // Not redirected, handle the response as needed
                            return response.text(); // Or return any other data you need
                        }
                    })
                    .then(newResponse => {
                        // Now you have the response from the redirected page
                        // You can set an output based on this response
                        // For example, check the URL or content of the page
                        if (newResponse.url === "https://example.com/redirected-page") {
                            // Set output based on the redirection
                            // For example:
                            console.log("Redirection successful");
                        } else {
                            // Handle other cases
                            console.log("Redirection failed");
                        }
                    })
                    .catch(error => {
                        // Handle errors
                        console.error("Error:", error);
                    });
            }
            else if (tracker === "ANT") {
                query_url = "https://anthelion.me/torrents.php?searchstr=" + imdb_id +"&order_by=time&order_way=desc&group_results=1&action=basic&searchsubmit=1";
            }
            else if (tracker === "RTF") {
                query_url = "https://retroflix.club/browse?years%5B%5D=1890&years%5B%5D=2024&includingDead=1&promotionType=&bookmarked=&search=" + imdb_id + "&searchIn=4&termMatchKind=0&submit=";
            }
            else if (tracker === "BHD") {
                query_url = "https://beyond-hd.me/library/movies?activity=&q=" + imdb_id;
            }
            else if (tracker === "BLU") {
                api_query_url =
                    "https://blutopia.cc/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    BLU_API_TOKEN;
            }
            else if (tracker === "TIK") {
                api_query_url =
                    "https://cinematik.net/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    TIK_API_TOKEN;
            }
            else if (tracker === "Aither") {
                api_query_url =
                    "https://aither.cc/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    AITHER_API_TOKEN;
            }
            else if (tracker === "RFX") {
                api_query_url =
                    "https://reelflix.xyz/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    RFX_API_TOKEN;
            }
            else if (tracker === "OE") {
                api_query_url =
                    "https://onlyencodes.cc/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    OE_API_TOKEN;
            }
            else if (tracker === "HUNO") {
                api_query_url =
                    "https://hawke.uno/api/torrents/filter?imdbId=" +
                    imdb_id.split("tt")[1] +
                    "&categories[0]=1&api_token=" +
                    HUNO_API_TOKEN;
            }
            else if (tracker === "AvistaZ") {
                query_url = "https://avistaz.to/movies?search=&imdb=" + imdb_id + "&view=lists";
            }
            else if (tracker === "CinemaZ") {
                query_url = "https://cinemaz.to/movies?search=&imdb=" + imdb_id + "&view=lists";
            }
            else if (tracker === "PHD") {
                query_url = "https://privatehd.to/movies?search=&imdb=" + imdb_id + "&view=lists";
            }
            else if (tracker === "FL") {
                query_url = "https://filelist.io/browse.php?search=" + imdb_id + "&cat=0&searchin=1&sort=3";
            }
            else if (tracker === "CG") {
                query_url = "https://cinemageddon.net/browse.php?search=" + imdb_id + "&orderby=size&dir=DESC";
            }
            else if (tracker === "KG") {
                query_url = "https://karagarga.in/browse.php?sort=size&search=" + imdb_id + "&search_type=imdb&d=DESC";
            }
            // console.log(query_url);

            if (use_api_instead(tracker) === false) {
                fetch_url(query_url)
                    .then(result => {
                        let movie_exist = is_movie_exist(tracker, result);

                        if (movie_exist === false) {
                            resolve([]);
                        }
                        else { // movie exist (not sure about exact size yet)
                            resolve(get_torrent_objs(tracker, result)); // torrent objs doner, sorted by size.
                        }
                    });
            }
            else {
                fetch(api_query_url).then((res) => {
                    res.json().then((data) => {
                        resolve(get_api_torrent_objects(tracker, data));
                    });
                }).catch(function () {
                    resolve([]);
                });
            }
        });
    };


    const get_api_discount = (text) => {
        if (text === "0%") return "None";
        else if (text === "100%") return "Freeleech";
        else return text + " Freeleech";
    };
    const get_api_internal = (internal) => {
        return internal === "1" ? true : false;
    };

    const get_api_torrent_objects = (tracker, json) => {
        let torrent_objs = [];

        if (
            tracker === "BLU" ||
            tracker === "Aither" ||
            tracker === "RFX" ||
            tracker === "OE" ||
            tracker === "HUNO" ||
            tracker === "TIK"
        ) {
            torrent_objs = json.data.map((element) => {
                return {
                    size: parseInt(element.attributes.size / (1024 * 1024)),
                    info_text: element.attributes.name,
                    tracker: tracker,
                    site: tracker,
                    snatch: element.attributes.times_completed,
                    seed: element.attributes.seeders,
                    leech: element.attributes.leechers,
                    download_link: element.attributes.download_link,
                    torrent_page: element.attributes.details_link,
                    discount: element.attributes.freeleech,
                    internal: element.attributes.internal,
                };
            });
        }

        torrent_objs = torrent_objs.map(e => {
            return { ...e, "quality": get_torrent_quality(e), "discount": get_api_discount(e.discount), "internal": get_api_internal(e.internal)};
        });

        return torrent_objs;
    };


    const get_filtered_torrents = (quality) => {
        let all_trs = [...document.querySelectorAll("tr.group_torrent")];
        let filtered_torrents = [];

        if (quality === "SD") {
            let first_idx = all_trs.findIndex((a) => a.textContent.includes("Standard Definition"));
            let sliced = all_trs.slice(first_idx + 1, all_trs.length);

            let last_idx = sliced.findIndex((a) => a.className === "group_torrent");
            if (last_idx === -1) last_idx = all_trs.length;
            filtered_torrents = sliced.slice(0, last_idx);
        }
        else if (quality === "HD") {
            let first_idx = all_trs.findIndex((a) => a.textContent.includes("High Definition") && !a.textContent.includes("Ultra High Definition"));
            let sliced = all_trs.slice(first_idx + 1, all_trs.length);

            let last_idx = sliced.findIndex((a) => a.className === "group_torrent");
            if (last_idx === -1) last_idx = all_trs.length;
            filtered_torrents = sliced.slice(0, last_idx);
        }
        else if (quality === "UHD") {
            let first_idx = all_trs.findIndex((a) => a.textContent.includes("Ultra High Definition"));
            let sliced = all_trs.slice(first_idx + 1, all_trs.length);

            let last_idx = sliced.findIndex((a) => a.className === "group_torrent");
            if (last_idx === -1) last_idx = all_trs.length;
            filtered_torrents = sliced.slice(0, last_idx);
        }

        // part 2 !
        let group_torrent_objs = [];

        filtered_torrents.forEach((t) => {
            try {
                let size_text = [...t.querySelectorAll("span")].find(s => s.title.includes(" bytes")).title;
                let size = Math.floor(parseInt(size_text.split(" bytes")[0].replace(/,/g, "")) / 1024 / 1024);
                let dom_path = t;

                group_torrent_objs.push({ dom_path, size });

            } catch (e) {
                console.error("An error has occurred: ", e);
            }
        });

        return group_torrent_objs;
    };


    const get_torrent_quality = (torrent) => {
        if (torrent.quality) return torrent.quality;

        let text = torrent.info_text.toLowerCase();

        if (text.includes("2160p")) return "UHD";
        else if (text.includes("1080p") || text.includes("720p") || text.includes("1080i") || text.includes("720i")) return "HD";
        else return "SD";
    };


    const get_ref_div = (torrent, ptp_torrent_group) => {
        let my_size = torrent.size;

        try {
            // dont add after this div, add it after the hidden div !
            let div = ptp_torrent_group.find(e => e.size < my_size).dom_path;
            let selector_id = "torrent_" + div.id.split("header_")[1];
            return document.getElementById(selector_id);
        } catch (e) {
            return false; // the size is too small, put it at the top of the group.
        }
    };


    const get_ptp_format_size = (size) => {
        if (size > 1024) { // GiB format
            return (size / 1024).toFixed(2) + " GiB";
        }
        else { // MiB format
            return (size).toFixed(2) + " MiB";
        }
    };


    const add_as_first = (div, quality) => { // puts 2gb 1080p at the top of the pack.
        let all_trs = [...document.querySelectorAll("tr.group_torrent")];
        let first_idx;

        if (quality === "SD") {
            first_idx = all_trs.findIndex((a) => a.textContent.includes("Standard Definition"));
        }
        else if (quality === "HD") {
            first_idx = all_trs.findIndex((a) => a.textContent.includes("High Definition") && !a.textContent.includes("Ultra High Definition"));
        }
        else if (quality === "UHD") {
            first_idx = all_trs.findIndex((a) => a.textContent.includes("Ultra High Definition"));
        }

        insertAfter(div, all_trs[first_idx]);
    };


    const get_codec = (lower, torrent) => {
        if (lower.includes("x264") || lower.includes("x.264")) return "x264 / ";
        else if (lower.includes("h264") || lower.includes("h.264")) return "H.264 / ";
        else if (lower.includes("x265") || lower.includes("x.265")) return "x265 / ";
        else if (lower.includes("h265") || lower.includes("h.265")) return "H.265 / ";
        else if (lower.includes("xvid") || lower.includes("x.vid")) return "XviD / ";
        else if (lower.includes("divx") || lower.includes("div.x")) return "DivX / ";
        else if (lower.includes("dvd5") || lower.includes("dvd-5") || lower.includes("dvd 5")) return "DVD5 / ";
        else if (lower.includes("dvd9") || lower.includes("dvd-9") || lower.includes("dvd 9")) return "DVD9 / ";

        else if (lower.includes("bd25") || lower.includes("bd-25")) return "BD25 / ";
        else if (lower.includes("bd50") || lower.includes("bd-50")) return "BD50 / ";
        else if (lower.includes("bd66") || lower.includes("bd-66")) return "BD66 / ";
        else if (lower.includes("bd100") || lower.includes("bd-100")) return "BD100 / ";

        return ""; // skip this info
    };


    const get_container = (lower, torrent) => {
        if (lower.includes("avi")) return "AVI / ";
        else if (lower.includes("mpg")) return "MPG / ";
        else if (lower.includes("mkv")) return "MKV / ";
        else if (lower.includes("mp4")) return "MP4 / ";
        else if (lower.includes("vob")) return "VOB / ";
        else if (lower.includes("iso")) return "ISO / ";
        else if (lower.includes("m2ts")) return "m2ts / ";

        return ""; // skip this info
    };


    const get_source = (lower, torrent) => {
        if (lower.includes("/cam")) return "CAM / ";
        else if (lower.includes("/ts")) return "TS / ";
        else if (lower.includes("/r5")) return "R5 / ";
        else if (lower.includes("vhs")) return "VHS / ";
        else if (lower.includes("web")) return "WEB / ";
        else if (lower.includes("dvd")) return "DVD / ";
        else if (lower.includes("hdtv") || lower.includes("hd-tv")) return "HDTV / ";
        else if (lower.includes("tv")) return "TV / ";
        else if (lower.includes("hddvd") || lower.includes("hd-dvd")) return "HD-DVD / ";
        else if (lower.includes("bluray") || lower.includes("blu-ray") || lower.includes("blu.ray") || lower.includes("blu ray")) return "Blu-ray / ";

        return ""; // skip this info
    };


    const get_res = (lower, torrent) => {
        if (lower.includes("ntsc")) return "NTSC / ";
        else if (lower.includes("pal")) return "PAL / ";
        else if (lower.includes("480p")) return "480p / ";
        else if (lower.includes("576p")) return "576p / ";
        else if (lower.includes("720p")) return "720p / ";
        else if (lower.includes("1080i")) return "1080i / ";
        else if (lower.includes("1080p")) return "1080p / ";
        else if (lower.includes("2160p")) return "2160p / ";

        return ""; // skip this info
    };

    const get_simplified_title = (info_text, torrent) => {
        let lower = info_text.toLowerCase();

        // required infos : codec (x264 vs) / container (mkv,mp4) / source (dvd,web,bluray) / res (1080p,720,SD,1024x768 etc) / Bonus (with commentary,remux, XYZ edition)
        let codec = get_codec(lower, torrent);
        let container = get_container(lower, torrent);
        let source = get_source(lower, torrent);
        let res = get_res(lower, torrent);

        let combined_text = codec + container + source + res;

        if (combined_text === "") return info_text;
        else return combined_text;
    };


    const get_discount_color = (discount) => {
        if (discount === "Freeleech") return "inherit";
        else if (discount === "50% Freeleech") return "inherit";
        else if (discount === "25% Freeleech") return "inherit";
        else return "inherit";
    };


    const add_external_torrents = (external_torrents) => {
        const existing_torrent_sizes = Array.from(document.querySelectorAll("span[style='float: left;']")).map(x => x.textContent);
        // console.log(existing_torrent_sizes);

        let sd_ptp_torrents = get_filtered_torrents("SD").sort((a, b) => a.size < b.size ? 1 : -1);
        let hd_ptp_torrents = get_filtered_torrents("HD").sort((a, b) => a.size < b.size ? 1 : -1);
        let uhd_ptp_torrents = get_filtered_torrents("UHD").sort((a, b) => a.size < b.size ? 1 : -1);

        create_needed_groups(external_torrents);

        external_torrents.forEach((torrent, i) => {
            let seeders = parseInt(torrent.seed);
            if (hide_dead_external_torrents && parseInt(seeders) === 0) return;

            let group_torrents;
            let ref_div;
            let tracker = torrent.site;
            let dom_id = tracker + "_" + i;

            if (torrent.quality === "UHD") {
                ref_div = get_ref_div(torrent, uhd_ptp_torrents);
                group_torrents = uhd_ptp_torrents; // needed just in case ref returns false/if its smallest
            } else if (torrent.quality === "HD") {
                ref_div = get_ref_div(torrent, hd_ptp_torrents);
                group_torrents = hd_ptp_torrents;
            } else {
                ref_div = get_ref_div(torrent, sd_ptp_torrents);
                group_torrents = sd_ptp_torrents;
            }

            let cln = line_example.cloneNode(true);

            if (show_tracker_name) {
                cln.querySelector(".torrent-info-link").textContent = `[${torrent.site}] ` + torrent.info_text;
            } else {
                cln.querySelector(".torrent-info-link").textContent = torrent.info_text;
            }

            // HDB only
            if (torrent.site === "HDB") {
                torrent.internal ? cln.querySelector(".torrent-info-link").innerHTML += " / <span style='font-weight: bold; color: #2f4879'>Internal</span>" : false;
                torrent.exclusive ? cln.querySelector(".torrent-info-link").innerHTML += " / <span style='font-weight: bold; color: #a14989'>Exclusive</span>" : false;
            }
            if (torrent.site === "MTV") {
                torrent.internal ? cln.querySelector(".torrent-info-link").innerHTML += " / <span style='font-weight: bold; color: #2f4879'>Internal</span>" : false;
            }
            if (torrent.site === "BLU") {
                torrent.internal ? (cln.querySelector(".torrent-info-link").innerHTML += " / <span style='font-weight: bold; color: #2f4879'>Internal</span>") : false;
            }
            torrent.discount != "None" ? cln.querySelector(".torrent-info-link").innerHTML += ` / <span style='font-weight: bold;color:${get_discount_color(torrent.discount)};'>` + torrent.discount + "!</span>" : false;

            //cln.querySelector(".torrent-info-link").textContent = torrent.info_text;
            if (torrent.status === "seeding") cln.querySelector(".torrent-info-link").className += " torrent-info-link--user-seeding";

            //cln.querySelector(".torrent-info-link").textContent = `[${torrent.site}] ` + get_simplified_title(torrent.info_text);

            [...cln.querySelector(".basic-movie-list__torrent__action").querySelectorAll("a")].find(a => a.textContent === "DL").href = torrent.download_link;

            const ptp_format_size = get_ptp_format_size(torrent.size);
            if (hide_if_torrent_with_same_size_exists && existing_torrent_sizes.includes(ptp_format_size)) {
                if (log_torrents_with_same_size) {
                    console.log(`[${torrent.site}] A ${ptp_format_size} torrent already exists:\n${torrent.info_text}\n${torrent.torrent_page}`);
                }
                return;
            }

            cln.querySelector(".size-span").textContent = ptp_format_size;
            cln.querySelector("td:nth-child(3)").textContent = torrent.snatch; // snatch
            cln.querySelector("td:nth-child(4)").textContent = torrent.seed; // seed

            if (torrent.seed === 0) {
                cln.querySelector("td:nth-child(4)").className = "no-seeders";
            }

            cln.querySelector("td:nth-child(5)").textContent = torrent.leech; // leech
            cln.querySelector(".link_3").href = torrent.torrent_page;
            cln.className += " " + dom_id;

            if (open_in_new_tab) cln.querySelector(".link_3").target = "_blank";

            if (show_tracker_icon) {
                cln.querySelector("img").src = get_tracker_icon(torrent.site);
                cln.querySelector("img").title = torrent.site;
            }

            if (ref_div != false) insertAfter(cln, ref_div);
            else {
                add_as_first(cln, torrent.quality);
            }

            let dom_path = cln;
            let quality = dom_get_quality(torrent.info_text);
            let discount = torrent.discount;
            let info_text = torrent.info_text;
            let leechers = parseInt(torrent.leech);
            let snatchers = parseInt(torrent.snatch);
            let size = torrent.size;

            doms.push({ tracker, dom_path, quality, discount, info_text, seeders, leechers, snatchers, dom_id, size });
        });

        let reduced_trackers = get_reduced_trackers(doms);
        let reduced_discounts = get_reduced_discounts(doms);
        let reduced_qualities = get_reduced_qualities(doms);

        if (!hide_filters_div) {
            add_filters_div(reduced_trackers, reduced_discounts, reduced_qualities);
            // disable_highlight()
            add_sort_listeners();
        }
    };


    const insert_group = (quality, header_div) => {
        let all_trs = [...document.querySelector("#torrent-table > tbody").querySelectorAll("tr.group_torrent")];
        let tbody = document.querySelector("#torrent-table > tbody");

        if (quality === "HD") {
            let idx = -2; // add_after_this_index

            for (let i = 0; i < all_trs.length; i++) {
                if (all_trs[i].textContent.includes("Other") || all_trs[i].textContent.includes("Ultra High Definition")) {
                    idx = i - 1;
                    break;
                }
            }
            if (idx === -2) {
                tbody.appendChild(header_div); // nothing to stop me
            } else {
                insertAfter(header_div, all_trs[idx]);
            }
        }
        else if (quality === "UHD") {
            let idx = -2; // add_after_this_index

            for (let i = 0; i < all_trs.length; i++) {
                if (all_trs[i].textContent.includes("Other")) {
                    idx = i - 1;
                    break;
                }
            }

            if (idx === -2) {
                tbody.appendChild(header_div); // nothing to stop me
            } else {
                insertAfter(header_div, all_trs[idx]);
            }
        }
    };


    const create_needed_groups = (torrents) => {
        let all_trs = [...document.querySelector("#torrent-table > tbody").querySelectorAll("tr.group_torrent")];
        let tbody = document.querySelector("#torrent-table > tbody");

        if (torrents.find(e => e.quality === "SD") != undefined && all_trs.find(d => d.textContent.includes("Standard Definition")) === undefined) {
            group_header_example.querySelector(".basic-movie-list__torrent-edition__sub").textContent = "Standard Definition";
            tbody.insertBefore(group_header_example, document.querySelector("#torrent-table > tbody").firstChild);
        }
        if (torrents.find(e => e.quality === "HD") != undefined &&
            all_trs.find(d => d.textContent.includes("High Definition") && !d.textContent.includes("Ultra High Definition")) === undefined) {
            group_header_example.querySelector(".basic-movie-list__torrent-edition__sub").textContent = "High Definition";
            insert_group("HD", group_header_example);
        }
        if (torrents.find(e => e.quality === "UHD") != undefined && all_trs.find(d => d.textContent.includes("Ultra High Definition")) === undefined) {
            group_header_example.querySelector(".basic-movie-list__torrent-edition__sub").textContent = "Ultra High Definition";
            insert_group("UHD", group_header_example);
        }
    };


    const fix_doms = () => {
        doms.forEach((d) => {
            d.dom_path = [...document.querySelectorAll(".group_torrent")].find(e => e.className.split(" ").find(c => c === d.dom_id) != undefined);
        });

    };


    const filter_torrents = () => {
        doms.forEach((e, i) => {
            let tracker_constraint = false;

            let inc_value = undefined;
            let exc_value = undefined; // should this be the initial value or should it be null?

            let status = filters.trackers.find(d => d.name === e.tracker).status;

            if (status === "include") inc_value = true;
            else if (status === "exclude") exc_value = true;

            if (inc_value === true) tracker_constraint = true;
            else if (exc_value === true) tracker_constraint = false; // actually this line is redundant.
            else {
                tracker_constraint = true;
                if (filters.trackers.filter(e => e.status === "include").length > 0) tracker_constraint = false;

            }

            if (tracker_constraint === false) {
                e.dom_path.style.display = "none";
                return;
            }
            ////////////////////
            let discount_constraint = false;

            let inc_value_2 = undefined;
            let exc_value_2 = undefined; // should this be the initial value or should it be null?

            let status_2 = filters.discounts.find(d => d.name === e.discount).status;

            if (status_2 === "include") inc_value_2 = true;
            else if (status_2 === "exclude") exc_value_2 = true;

            if (inc_value_2 === true) discount_constraint = true;
            else if (exc_value_2 === true) discount_constraint = false; // actually this line is redundant.
            else { // neutral
                discount_constraint = true;
                if (filters.discounts.filter(e => e.status === "include").length > 0) discount_constraint = false;
            }

            if (discount_constraint === false) {
                e.dom_path.style.display = "none";
                return;
            }
            /////////////////////////////////
            let quality_constraint = false;

            let inc_value_3 = undefined;
            let exc_value_3 = undefined; // should this be the initial value or should it be null?

            let status_3 = filters.qualities.find(d => d.name === e.quality).status;

            if (status_3 === "include") inc_value_3 = true;
            else if (status_3 === "exclude") exc_value_3 = true;

            if (inc_value_3 === true) quality_constraint = true;
            else if (exc_value_3 === true) quality_constraint = false; // actually this line is redundant.
            else { // neutral
                quality_constraint = true;
                if (filters.qualities.filter(e => e.status === "include").length > 0) quality_constraint = false;
            }

            if (quality_constraint === false) {
                e.dom_path.style.display = "none";
                return;
            }
            //////////////////////

            let text_constraint = true;
            let must_include_words = document.querySelector(".torrent-search").value.split(" ").map((w) => w.toLowerCase());

            for (let word of must_include_words) {
                if (e.info_text.toLowerCase().includes(word) === false) {
                    text_constraint = false;
                    break;
                }
            }

            if (text_constraint === false) {
                e.dom_path.style.display = "none";
                return;
            }

            // congrats !
            e.dom_path.style.display = "table-row";
        });
    };


    function show_only_ptp() {
        const dom_path = document.querySelector("#filter-ptp");
        filters.trackers.find(e => e.name === "PTP").status = "include";
        dom_path.style.background = "#40E0D0";
        dom_path.style.color = "#111";

        filter_torrents();
    }


    const update_filter_box_status = (object_key, value, dom_path) => { // object_key = tracker/quality/discount || value = BHD, HDB, 50% Freeleech, 720p etc...
        // let all_values = ["default", "include", "exclude"];

        if (object_key === "trackers") {
            let current_status = filters.trackers.find(e => e.name === value).status;

            if (current_status === "default") {
                filters.trackers.find(e => e.name === value).status = "include";
                dom_path.style.background = "#40E0D0";
                dom_path.style.color = "#111";
            } else if (current_status === "include") {
                filters.trackers.find(e => e.name === value).status = "exclude";
                dom_path.style.background = "#920000";
                dom_path.style.color = "#eee";
            } else {
                filters.trackers.find(e => e.name === value).status = "default";
                dom_path.style.background = "";
                dom_path.style.opacity = 1;
            }
        }
        else if (object_key === "discounts") {
            let current_status = filters.discounts.find(e => e.name === value).status;

            if (current_status === "default") {
                filters.discounts.find(e => e.name === value).status = "include";
                dom_path.style.background = "#40E0D0";
                dom_path.style.color = "#111";
            } else if (current_status === "include") {
                filters.discounts.find(e => e.name === value).status = "exclude";
                dom_path.style.background = "#920000";
                dom_path.style.color = "#eee";
            } else {
                filters.discounts.find(e => e.name === value).status = "default";
                dom_path.style.background = "";
                dom_path.style.opacity = 1;
            }
        }
        else if (object_key === "qualities") {
            let current_status = filters.qualities.find(e => e.name === value).status;

            if (current_status === "default") {
                filters.qualities.find(e => e.name === value).status = "include";
                dom_path.style.background = "#40E0D0";
                dom_path.style.color = "#111";
            } else if (current_status === "include") {
                filters.qualities.find(e => e.name === value).status = "exclude";
                dom_path.style.background = "#920000";
                dom_path.style.color = "#eee";
            } else {
                filters.qualities.find(e => e.name === value).status = "default";
                dom_path.style.background = "";
                dom_path.style.opacity = 1;
            }
        }

        filter_torrents(); // big update
    };


    const fix_ptp_names = () => {
        document.querySelectorAll("tr.group_torrent").forEach(d => {
            if (d.className != "group_torrent") {
                const torrent = d.querySelector("a.torrent-info-link");
                torrent.innerHTML = "[PTP] " + torrent.innerHTML;
            }
        });
    };


    const add_filters_div = (trackers, discounts, qualities) => {
        let addBeforeThis = document.querySelector("#movieinfo");

        let div = document.createElement("div");
        div.className = "panel__body";
        div.style.padding = "0 10px 5px 10px";

        let filterByTracker = document.createElement("div");
        filterByTracker.style = "display: flex; align-items: baseline";

        let label = document.createElement("div");
        label.textContent = "Tracker: ";
        label.style.cursor = "default";
        label.style.flex = "0 0 60px";
        filterByTracker.appendChild(label);

        filterByTracker.style.margin = "4px 0";

        let trackerContents = document.createElement("div");

        trackers.forEach((tracker_name) => {
            let div = document.createElement("div");
            div.id = `filter-${tracker_name.toLowerCase()}`;
            div.className = "filter-box";
            div.textContent = tracker_name;
            div.style.padding = "2px 5px";
            div.style.margin = "3px";
            div.style.color = "#eee";
            div.style.display = "inline-block";
            div.style.cursor = "pointer";
            // div.style.width = "40px"
            div.style.border = "1px dashed #606060";
            div.style.fontSize = "1em";
            div.style.textAlign = "center";

            div.addEventListener("click", () => {
                update_filter_box_status("trackers", tracker_name, div);
            });

            trackerContents.append(div);
        });

        filterByTracker.append(trackerContents);
        div.append(filterByTracker);

        let additional_settings = document.createElement("div"); // discounts
        additional_settings.style = "display: flex; align-items: baseline";

        let label_2 = document.createElement("div");
        label_2.textContent = "Discount: ";
        label_2.style.cursor = "default";
        label_2.style.flex = "0 0 60px";
        additional_settings.appendChild(label_2);

        let discountContents = document.createElement("div");

        discounts.forEach((discount_name) => {
            let only_discount = document.createElement("div");
            only_discount.className = "filter-box";
            only_discount.textContent = discount_name;
            only_discount.style.padding = "2px 5px";
            only_discount.style.margin = "3px";
            only_discount.style.color = "#eee";
            only_discount.style.display = "inline-block";
            only_discount.style.cursor = "pointer";
            only_discount.style.border = "1px dashed #606060";
            only_discount.style.fontSize = "1em";

            only_discount.addEventListener("click", () => {
                update_filter_box_status("discounts", discount_name, only_discount);
            });
            discountContents.append(only_discount);
        });

        additional_settings.append(discountContents);
        div.append(additional_settings);

        ///////
        let filterByQuality = document.createElement("div");
        filterByQuality.style = "display: flex; align-items: baseline";

        let label_3 = document.createElement("div");
        label_3.textContent = "Quality: ";
        label_3.style.cursor = "default";
        label_3.style.flex = "0 0 60px";
        filterByQuality.appendChild(label_3);

        filterByQuality.style.margin = "4px 0";

        let qualityContents = document.createElement("div");

        qualities.forEach((quality_name) => {

            let quality = document.createElement("div");
            quality.className = "filter-box";
            quality.textContent = quality_name;
            quality.style.padding = "2px 5px";
            quality.style.margin = "3px";
            quality.style.color = "#eee";
            quality.style.display = "inline-block";
            quality.style.cursor = "pointer";
            quality.style.border = "1px dashed #606060";
            quality.style.fontSize = "1em";
            quality.style.textAlign = "center";

            quality.addEventListener("click", () => {
                update_filter_box_status("qualities", quality_name, quality);
            });

            qualityContents.append(quality);
        });

        filterByQuality.append(qualityContents);
        div.append(filterByQuality);

        /////////////////////
        let filterByText = document.createElement("div");
        filterByText.style.margin = "8px 0 0";

        let input = document.createElement("input");
        input.className = "torrent-search search-bar__search-field__input";
        input.type = "text";
        input.spellcheck = false;
        input.placeholder = "Search torrents...";
        input.style.fontSize = "1em";
        input.style.width = "84%";

        input.addEventListener("input", (e) => {
            filter_torrents();
        });

        filterByText.appendChild(input);

        // reset btn
        let rst = document.createElement("div");
        rst.textContent = "⟳";

        rst.style.padding = "4px 8px";
        rst.style.margin = "0px 4px";
        rst.style.color = "#eee";
        rst.style.display = "inline-block";
        rst.style.cursor = "pointer";
        rst.style.border = "1px dashed #606060";
        rst.style.fontSize = "1em";
        rst.style.textAlign = "center";

        rst.addEventListener("click", () => {
            document.querySelector(".torrent-search").value = "";
            filters = {
                "trackers": trackers.map((e) => {
                    return ({ "name": e, "status": "default" });
                }),
                "discounts": discounts.map((e) => {
                    return ({ "name": e, "status": "default" });
                }),
                "qualities": qualities.map((e) => {
                    return ({ "name": e, "status": "default" });
                }),
            };

            filter_torrents();

            document.querySelectorAll(".filter-box").forEach(d => {
                d.style.background = "";
                d.style.color = "#eee";
            });
        });

        filterByText.appendChild(rst);

        div.appendChild(filterByText);

        const panel = document.createElement("div");
        panel.className = "panel";
        const panelHeading = document.createElement("div");
        panelHeading.className = "panel__heading";

        const panelHeadingTitle = document.createElement("span");
        panelHeadingTitle.textContent = "Filter Releases";
        panelHeadingTitle.className = "panel__heading__title";
        panelHeading.append(panelHeadingTitle);

        panel.append(panelHeading, div);


        addBeforeThis.insertAdjacentElement("beforeBegin", panel);

        // done.
    };


    const get_example_div = () => {
        let tr = document.createElement("tr");
        tr.className = "group_torrent group_torrent_header";
        tr["data-releasename"] = "release_name_here";

        let td = document.createElement("td");
        td.style.width = "596px";

        let span = document.createElement("span");
        span.className = "basic-movie-list__torrent__action";
        span.style.marginLeft = "12px";
        span.textContent = "[";

        let a = document.createElement("a");
        a.href = "#";
        a.className = "link_1";
        a.textContent = "DL";
        a.title = "Download";

        span.appendChild(a);
        span.innerHTML += "]"; //////////// kekwait

        let a2 = document.createElement("a");
        a2.href = "#";
        a2.className = "link_2";
        a2.style.marginRight = "4px";

        let img = document.createElement("img");
        img.style.width = "12px";
        img.style.height = "12px";
        img.src = "static/common/check.png";
        img.alt = "☑";
        img.title = "Tracker title";

        a2.appendChild(img);

        let a3 = document.createElement("a");
        a3.href = "link_3";
        a3.className = "torrent-info-link link_3";
        a3.textContent = "INFO_TEXT_HERE";

        td.appendChild(span);
        td.appendChild(a2);
        td.appendChild(a3);

        let td2 = document.createElement("td");
        td2.className = "nobr";
        td2.style.width = "63px";

        let span2 = document.createElement("span");
        span2.className = "size-span";
        span2.style.float = "left";
        span2.textContent = "TORRENT_SIZE_HERE";
        td2.appendChild(span2);

        let td3 = document.createElement("td");
        td3.style.width = "31px";

        let td4 = document.createElement("td");
        td3.style.width = "21px";

        let td5 = document.createElement("td");
        td3.style.width = "10px";

        tr.appendChild(td);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);

        return tr;
    };


    const disable_highlight = () => {
        document.querySelector(".filter-container").addEventListener("mousedown", function (event) {
            if (event.detail > 1) {
                event.preventDefault();
                // of course, you still do not know what you prevent here...
                // You could also check event.ctrlKey/event.shiftKey/event.altKey
                // to not prevent something useful.
            }
        }, false);


        document.querySelector("table.torrent_table > thead").addEventListener("mousedown", function (event) {
            if (event.detail > 1) {
                event.preventDefault();
                // of course, you still do not know what you prevent here...
                // You could also check event.ctrlKey/event.shiftKey/event.altKey
                // to not prevent something useful.
            }
        }, false);



    };

    const get_sorted_qualities = (qualities) => {
        let arr = [];

        qualities.forEach(q => {

            if (q === "SD") arr.push({ "value": 0, "name": q });
            else if (q === "480p") arr.push({ "value": 1, "name": q });
            else if (q === "576p") arr.push({ "value": 2, "name": q });
            else if (q === "720p") arr.push({ "value": 3, "name": q });
            else if (q === "1080p") arr.push({ "value": 4, "name": q });
            else if (q === "2160p") arr.push({ "value": 5, "name": q });

        });

        return arr.sort((a, b) => (a.value > b.value) ? 1 : -1).map(e => e.name);
    };


    const get_sorted_discounts = (discounts) => {
        // let discounts = ["Freeleech", "75% Freeleech", "50% Freeleech", "25% Freeleech", "Refundable", "Rewind", "Rescuable", "None"]
        let arr = [];

        discounts.forEach(q => {
            if (q === "None") arr.push({ "value": 0, "name": q });
            else if (q === "Rescuable") arr.push({ "value": 1, "name": q });
            else if (q === "Rewind") arr.push({ "value": 2, "name": q });
            else if (q === "Refundable") arr.push({ "value": 3, "name": q });
            else if (q === "25% Freeleech") arr.push({ "value": 4, "name": q });
            else if (q === "50% Freeleech") arr.push({ "value": 5, "name": q });
            else if (q === "75% Freeleech") arr.push({ "value": 6, "name": q });
            else if (q === "Freeleech") arr.push({ "value": 7, "name": q });
        });

        return arr.sort((a, b) => (a.value < b.value) ? 1 : -1).map(e => e.name);
    };


    const get_reduced_trackers = (doms) => {
        let lst = []; // default

        doms.forEach(t => {
            if (lst.includes(t.tracker) === false) lst.push(t.tracker);
        });

        return lst.sort((a, b) => a > b ? 1 : -1);

    };


    const get_reduced_discounts = (doms) => {
        let lst = [];

        doms.forEach(t => {
            if (lst.includes(t.discount) === false) lst.push(t.discount);
        });

        return get_sorted_discounts(lst);

    };


    const get_reduced_qualities = (doms) => {
        let lst = [];

        qualities.forEach(q => {
            for (let i = 0; i < doms.length; i++) {
                if (doms[i].info_text.toLowerCase().includes(q.toLowerCase()) && q != "SD" && !lst.includes(q)) {
                    lst.push(q);
                    break;
                }
            }
        });

        return get_sorted_qualities(lst.concat(["SD"]));
    };


    let seed_desc = true;
    let leech_desc = true;
    let snatch_desc = true;
    let size_desc = true;


    const add_sort_listeners = () => {
        let seed_th = [...document.querySelector("table.torrent_table").querySelectorAll("th")].filter(e => e.querySelector("img") != null).find(t => t.querySelector("img").src.includes("seeders.png"));

        seed_th.style.cursor = "pointer";
        seed_th.addEventListener("click", () => {
            if (seed_desc) doms = doms.sort((a, b) => parseInt(a.seeders) < parseInt(b.seeders) ? 1 : -1);
            else doms = doms.sort((a, b) => parseInt(a.seeders) > parseInt(b.seeders) ? 1 : -1);

            seed_desc = !seed_desc;

            document.querySelectorAll(".group_torrent").forEach(d => d.remove());

            doms.forEach(d => document.querySelector("table.torrent_table > tbody").appendChild(d.dom_path));
        });

        /////////////////////////////////////
        let leech_th = [...document.querySelector("table.torrent_table").querySelectorAll("th.sign")].filter(e => e.querySelector("img") != null).find(t => t.querySelector("img").src.includes("leechers.png"));

        leech_th.style.cursor = "pointer";
        leech_th.addEventListener("click", () => {
            if (leech_desc) doms = doms.sort((a, b) => parseInt(a.leechers) < parseInt(b.leechers) ? 1 : -1);
            else doms = doms.sort((a, b) => parseInt(a.leechers) > parseInt(b.leechers) ? 1 : -1);

            leech_desc = !leech_desc;

            document.querySelectorAll(".group_torrent").forEach(d => d.remove());

            doms.forEach(d => document.querySelector("table.torrent_table > tbody").appendChild(d.dom_path));
        });

        ////////////////////////////
        let snatch_th = [...document.querySelector("table.torrent_table").querySelectorAll("th")].filter(e => e.querySelector("img") != null).find(t => t.querySelector("img").src.includes("snatched.png"));

        snatch_th.style.cursor = "pointer";
        snatch_th.addEventListener("click", () => {
            if (snatch_desc) doms = doms.sort((a, b) => parseInt(a.snatchers) < parseInt(b.snatchers) ? 1 : -1);
            else doms = doms.sort((a, b) => parseInt(a.snatchers) > parseInt(b.snatchers) ? 1 : -1);

            snatch_desc = !snatch_desc;

            document.querySelectorAll(".group_torrent").forEach(d => d.remove());

            doms.forEach(d => document.querySelector("table.torrent_table > tbody").appendChild(d.dom_path));
        });

        /////////////////////////////////
        let size_th = [...document.querySelector("table.torrent_table").querySelectorAll("th")].find(e => e.textContent === "Size");

        size_th.style.cursor = "pointer";
        size_th.addEventListener("click", () => {

            if (size_desc) doms = doms.sort((a, b) => parseInt(a.size) < parseInt(b.size) ? 1 : -1);
            else doms = doms.sort((a, b) => parseInt(a.size) > parseInt(b.size) ? 1 : -1);

            size_desc = !size_desc;

            document.querySelectorAll(".group_torrent").forEach(d => d.remove());

            doms.forEach(d => document.querySelector("table.torrent_table > tbody").appendChild(d.dom_path));
        });
    };


    let line_example = get_example_div();
    let group_header_example = document.querySelector("tr.group_torrent").cloneNode(true);
    let original_table;


    const mainFunc = async () => {
        if (show_tracker_name) {
            fix_ptp_names();
        }

        let imdb_id;

        try {
            imdb_id = "tt" + document.getElementById("imdb-title-link").href.split("/tt")[1].split("/")[0];
        } catch (e) { // replaced by ratings box script...
            imdb_id = "tt" + [...document.querySelectorAll(".rating")].find(a => a.href.includes("imdb.com")).href.split("/tt")[1].split("/")[0];
        }

        let promises = [];

        trackers.forEach(t => promises.push(fetch_tracker(t, imdb_id)));

        Promise.all(promises)
            .then(torrents_lists => {
                var all_torrents = [].concat.apply([], torrents_lists).sort((a, b) => a.size < b.size ? 1 : -1);

                add_external_torrents(all_torrents);

                document.querySelectorAll(".basic-movie-list__torrent__action").forEach(d => { d.style.marginLeft = "12px"; }); // style fix

                original_table = document.querySelector("table.torrent_table").cloneNode(true);

                if (show_only_ptp_by_default) {
                    show_only_ptp();
                }

                localStorage.setItem("play_now_flag", "true"); // yy
            });
    };


    mainFunc();
})();
