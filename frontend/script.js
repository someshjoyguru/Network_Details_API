async function findNetworkDetailsHandler() {
    const urlInput = document.getElementById('url-input').value;
    console.log('Input URL:', urlInput); // Log the input URL to the console
    const findBtn = document.getElementById('find-btn');
    const loader = document.getElementById('loader');
    const message = document.getElementById('message');
    const heading = document.getElementById('heading');
    const results = document.getElementById('results');

    if (!urlInput) {
        message.innerText = 'Please enter a URL.';
        return;
    }

    findBtn.disabled = true;
    loader.style.display = 'block';
    message.innerText = '';
    heading.classList.add('hidden');
    results.classList.add('hidden');

    try {
        const response = await fetch(`https://network-details.vercel.app/api/fetchNetworkData`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ website: urlInput }),
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const data = await response.json();
        if (data.success) {
            displayResults(data.data);
        } else {
            message.innerText = 'Invalid website URL or server error.';
        }
    } catch (error) {
        message.innerText = 'Request TimeOut! Please try again later.';
    } finally {
        findBtn.disabled = false;
        loader.style.display = 'none';
    }
}

function displayResults(data) {
    const results = document.getElementById('results');
    const heading = document.getElementById('heading');

    const { protocol_type, src_bytes, dst_bytes, service, flag, count, same_srv_rate, diff_srv_rate, dst_host_srv_count, dst_host_same_srv_rate } = data;

    results.innerHTML = `
        <p><strong>Protocol Type:</strong> ${protocol_type.join(', ')}</p>
        <p><strong>Source Bytes:</strong> ${src_bytes.join(', ')}</p>
        <p><strong>Destination Bytes:</strong> ${dst_bytes.join(', ')}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Flag:</strong> ${flag}</p>
        <p><strong>Count:</strong> ${count}</p>
        <p><strong>Same Service Rate:</strong> ${same_srv_rate}</p>
        <p><strong>Different Service Rate:</strong> ${diff_srv_rate}</p>
        <p><strong>Destination Host Service Count:</strong> ${dst_host_srv_count}</p>
        <p><strong>Destination Host Same Service Rate:</strong> ${dst_host_same_srv_rate}</p>
    `;

    heading.classList.remove('hidden');
    results.classList.remove('hidden');
}