import React, { useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";

function App() {
    const [language, setLanguage] = useState("en");
    const [searchTerm, setSearchTerm] = useState("");
    const [bookResults, setBookResults] = useState([]);
    const [file, setFile] = useState(null);
    const [summary, setSummary] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const [loading, setLoading] = useState(false);

    // 🔍 Direct OpenLibrary Search
    const searchBooks = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        try {
            const res = await axios.get(
                `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}`
            );
            const topResults = res.data.docs.slice(0, 10).map((doc) => ({
                title: doc.title,
                author: doc.author_name?.[0] || "Unknown",
                cover_i: doc.cover_i,
                key: doc.key,
            }));
            setBookResults(topResults);
        } catch (err) {
            console.error("OpenLibrary search failed:", err);
            setBookResults([]);
        }
    };

    // 📖 Summarize book (needs backend support)
    const summarizeBook = async (bookKey) => {
        setLoading(true);
        setSummary("");
        setAudioUrl("");

        try {
            const params = new URLSearchParams();
            params.append("book_key", bookKey);
            params.append("language", language);

            const res = await axios.post("http://localhost:8000/summarize_book", params, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            const data = res.data;

            if (data.summary) {
                setSummary(data.summary);
            } else {
                setSummary("No summary received.");
            }

            if (data.audio) {
                const audioBlob = b64toBlob(data.audio, "audio/mpeg");
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
            } else {
                setAudioUrl("");
            }
        } catch (err) {
            console.error("Summarize book error:", err);
            setSummary("Error summarizing book. Is backend running?");
            setAudioUrl("");
        } finally {
            setLoading(false);
        }
    };

    // 📁 Summarize uploaded file
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setLoading(true);
        setSummary("");
        setAudioUrl("");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", language);

        try {
            const res = await axios.post("http://localhost:8000/summarize", formData);

            const data = res.data;

            if (data.summary) {
                setSummary(data.summary);
            } else {
                setSummary("No summary received.");
            }

            if (data.audio) {
                const audioBlob = b64toBlob(data.audio, "audio/mpeg");
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
            } else {
                setAudioUrl("");
            }
        } catch (err) {
            console.error("File summarization failed:", err);
            setSummary("Failed to summarize file. Check backend.");
            setAudioUrl("");
        } finally {
            setLoading(false);
        }
    };

    const downloadSummary = () => {
        const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "summary.txt");
    };

    const downloadAudio = () => {
        if (audioUrl) {
            fetch(audioUrl)
                .then((r) => r.blob())
                .then((b) => saveAs(b, "summary.mp3"));
        }
    };

    // Helper function to convert base64 to Blob
    const b64toBlob = (b64Data, contentType = "", sliceSize = 512) => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        return blob;
    };

    return (
        <div className="min-h-screen bg-gradient-to-r from-purple-200 to-indigo-200 py-8 px-4">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Book Search */}
                <section className="bg-white p-6 rounded-lg shadow-lg flex flex-col">
                    <h2 className="text-3xl font-bold mb-6 text-indigo-700">Search Free Books</h2>
                    <form onSubmit={searchBooks} className="flex mb-6 gap-3">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Book title..."
                            className="flex-grow p-3 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-6 rounded-md hover:bg-indigo-700 transition"
                        >
                            Search
                        </button>
                    </form>
                    <div className="overflow-y-auto max-h-[26rem] space-y-4">
                        {bookResults.map((book, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-5 p-3 bg-indigo-50 rounded-md shadow-sm"
                            >
                                {book.cover_i ? (
                                    <img
                                        src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                                        alt="cover"
                                        className="w-20 h-28 rounded-md object-cover shadow"
                                    />
                                ) : (
                                    <div className="w-20 h-28 bg-indigo-100 rounded-md" />
                                )}
                                <div className="flex-grow">
                                    <h3 className="text-lg font-semibold text-indigo-900">{book.title}</h3>
                                    <p className="text-sm text-indigo-700">by {book.author}</p>
                                </div>
                                <button
                                    onClick={() => summarizeBook(book.key)}
                                    disabled={loading}
                                    className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 disabled:opacity-50 transition"
                                >
                                    Summarize
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* File Upload */}
                <section className="bg-white p-6 rounded-lg shadow-lg flex flex-col">
                    <h2 className="text-3xl font-bold mb-6 text-indigo-700">Upload PDF/Text</h2>
                    <form onSubmit={handleUpload} className="flex flex-col space-y-5">
                        <label className="text-indigo-800 font-semibold">Select Language</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="border border-indigo-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="en">English</option>
                            <option value="fr">French</option>
                            <option value="es">Spanish</option>
                            <option value="af">Afrikaans</option>
                            <option value="zu">Zulu</option>
                        </select>

                        <label className="text-indigo-800 font-semibold">Choose File</label>
                        <input
                            type="file"
                            accept=".pdf,.txt"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="border border-indigo-300 rounded-md p-2 cursor-pointer"
                        />

                        <button
                            type="submit"
                            disabled={loading || !file}
                            className="bg-indigo-700 text-white py-3 rounded hover:bg-indigo-800 disabled:opacity-50 transition"
                        >
                            {loading ? "Processing..." : "Summarize & Voice"}
                        </button>
                    </form>
                </section>

                {/* Summary Display */}
                {summary && (
                    <section className="md:col-span-2 bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-3xl font-bold mb-6 text-indigo-700">Summary</h2>
                        <textarea
                            value={summary}
                            readOnly
                            rows={10}
                            className="w-full p-4 border border-indigo-300 rounded-md text-indigo-900 resize-none"
                        />
                        <div className="flex flex-wrap gap-4 mt-4 items-center">
                            <button
                                onClick={downloadSummary}
                                className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 transition"
                            >
                                Download TXT
                            </button>
                            {audioUrl && (
                                <>
                                    <audio controls src={audioUrl} className="max-w-lg flex-grow" />
                                    <button
                                        onClick={downloadAudio}
                                        className="bg-yellow-500 text-white px-5 py-2 rounded hover:bg-yellow-600 transition"
                                    >
                                        Download MP3
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                )}

                {loading && (
                    <p className="md:col-span-2 text-center text-indigo-800 font-semibold text-lg mt-4">
                        Processing Please Be Patient⌛...
                    </p>
                )}
            </div>
        </div>
    );
}

export default App;
