// ==========================
// 搜索数据
// ==========================

const searchData = [

    {
        keyword: "请假",
        category: "请假专区",
        url: "pages/leave.html"
    },


    {
        keyword: "文件下载",
        url: "pages/download.html"
    },

    {
        keyword: "奖学金",
        url: "pages/scholarship.html"
    },

    {
        keyword: "学术活动",
        url: "pages/academic.html"
    },

    {
        keyword: "毕业",
        category: "毕业专区",
        url: "pages/graduation.html"
    },

    {
        keyword: "毕业登记表",
        url: "pages/graduation.html"
    },

    {
        keyword: "学位申请",
        url: "pages/graduation.html"
    },

    {
        keyword: "FAQ",
        url: "pages/faq.html"
    }

];

const searchInput =
document.getElementById("global-search");

// ==========================
// 回车搜索
// ==========================

if(searchInput){

    searchInput.addEventListener(
        "keydown",
        function(e){

            if(e.key === "Enter"){

                const keyword =
                this.value.trim();

                const result =
                searchData.find(item =>
                    item.keyword.includes(keyword)
                    ||
                    keyword.includes(item.keyword)
                );

                if(result){

                    window.location.href =
                    result.url;

                }else{

                    alert("未找到相关内容");

                }

            }

        }
    );

}

////////////////////
// ==========================
// 搜索联想
// ==========================

const suggestionBox =
document.getElementById(
    "search-suggestions"
);

if(searchInput){

    searchInput.addEventListener(
        "input",
        function(){

            const value =
            this.value.trim();

            suggestionBox.innerHTML = "";

            if(!value){

    suggestionBox.style.display =
    "none";

    return;
}
suggestionBox.style.display =
"block";
            const matches =
            searchData.filter(item =>
                item.keyword.includes(value)
            );

            matches.forEach(item => {

                const div =
                document.createElement("div");

                div.className =
                "suggestion-item";

                div.innerHTML = `

                <div>

                    <strong>

                        ${item.keyword}

                    </strong>

                    <small>

                        ${item.category}

                    </small>

                </div>

                `;

                div.onclick = () => {

                    window.location.href =
                    item.url;

                };

                suggestionBox.appendChild(div);

            });

        }
    );

}
///////////////////点击空白关闭
document.addEventListener(
    "click",
    function(e){

        if(
            !searchInput.contains(e.target)
            &&
            !suggestionBox.contains(e.target)
        ){

            suggestionBox.style.display =
            "none";

        }

    }
);