async function loadFAQ() {

    try {

        const response =
            await fetch("../data/faq.json");

        const faqs =
            await response.json();

        const container =
            document.getElementById(
                "faq-container"
            );

        faqs.forEach(item => {

            const card =
                document.createElement("div");

            card.className =
                "faq-card";

            card.innerHTML = `

                <h3>${item.question}</h3>

                <p>${item.answer}</p>

            `;

            container.appendChild(card);

        });

    } catch(error) {

        console.error(error);

    }

}

loadFAQ();