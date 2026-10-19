import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Headphones,
  History,
  LayoutGrid,
  ListMusic,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { categories, episodes, type Episode } from "../lib/catalog";
function stored(key: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function time(t: number) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}
export default function PodcastApp() {
  const [page, setPage] = useState("Discover"),
    [category, setCategory] = useState("All podcasts"),
    [search, setSearch] = useState(""),
    [saved, setSaved] = useState<number[]>(() => stored("frequency-saved")),
    [history, setHistory] = useState<number[]>(() => stored("frequency-history"));
  const [current, setCurrent] = useState(episodes[0]),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(1),
    [volume, setVolume] = useState(0.7),
    [detail, setDetail] = useState<Episode | null>(null),
    [notice, setNotice] = useState(""),
    [mobileMenu, setMobileMenu] = useState(false),
    [queue, setQueue] = useState(false),
    [all, setAll] = useState(false),
    [trendingOffset, setTrendingOffset] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setDetail(null);
        setQueue(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    localStorage.setItem("frequency-saved", JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    localStorage.setItem("frequency-history", JSON.stringify(history));
  }, [history]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.playbackRate = speed;
    }
  }, [volume, speed]);
  function toggleSave(id: number) {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function play(ep: Episode) {
    setCurrent(ep);
    setHistory((s) => [ep.id, ...s.filter((x) => x !== ep.id)]);
    if (audio.current) {
      audio.current.currentTime = 0;
      audio.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setNotice("Playback unavailable. Please try again."));
    }
  }
  function togglePlay() {
    if (!audio.current) return;
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      audio.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setNotice("Unable to play audio preview."));
      setHistory((s) => [current.id, ...s.filter((x) => x !== current.id)]);
    }
  }
  function seek(t: number) {
    if (audio.current) audio.current.currentTime = Math.max(0, Math.min(duration, t));
  }
  function next(dir: number) {
    play(
      episodes[
        (episodes.findIndex((e) => e.id === current.id) + dir + episodes.length) % episodes.length
      ],
    );
  }
  function nav(name: string) {
    setPage(name);
    setMobileMenu(false);
    setCategory("All podcasts");
    setSearch("");
    setAll(false);
  }
  let filtered = episodes.filter(
    (e) =>
      (category === "All podcasts" || e.category === category) &&
      `${e.show} ${e.title} ${e.host}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (page === "Saved shows") filtered = filtered.filter((e) => saved.includes(e.id));
  if (page === "Recently played")
    filtered = history
      .map((id) => episodes.find((e) => e.id === id)!)
      .filter(
        (e) =>
          e && (!search || `${e.show} ${e.title}`.toLowerCase().includes(search.toLowerCase())),
      );
  const isDiscover = page === "Discover" && !search;
  const display =
    all || page !== "Discover" || category !== "All podcasts" || search
      ? filtered
      : filtered.slice(0, 4);
  const trend = Array.from(
    { length: 3 },
    (_, i) => episodes[(4 + i + trendingOffset) % episodes.length],
  );
  function Cover({ ep, mini = false }: { ep: Episode; mini?: boolean }) {
    return (
      <div className={`cover ${ep.style} ${mini ? "mini" : ""}`}>
        {ep.image && <img src={`/images/${ep.image}.jpg`} alt="" />}
        <div className="cover-shade" />
        <div className="cover-top">FREQUENCY ORIGINAL</div>
        <div className="cover-title">
          {ep.show === "SMALL TALK. BIG IDEAS." ? (
            <>
              small talk.
              <br />
              <em>big ideas.</em>
            </>
          ) : (
            ep.show
          )}
        </div>
        <div className="cover-bottom">
          {ep.host} <AudioLines size={15} />
        </div>
        {ep.style === "small" && (
          <div className="orbit-art">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <button className="brand" onClick={() => nav("Discover")}>
          <AudioLines size={30} strokeWidth={2.5} />
          <span>
            frequency<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="nav-label">YOUR DAILY DISCOVERY</div>
        <nav>
          {[
            { name: "Discover", Icon: Compass },
            { name: "Browse", Icon: LayoutGrid },
            { name: "Saved shows", Icon: Bookmark },
            { name: "Recently played", Icon: History },
          ].map(({ name, Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => nav(name)}
            >
              <Icon size={19} />
              {name}
              {name === "Saved shows" && saved.length > 0 && (
                <span className="count">{saved.length}</span>
              )}
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-divider" />
        <div className="nav-label">MADE FOR YOUR EARS</div>
        <button
          className="nav-item"
          onClick={() => {
            nav("Browse");
            setCategory("All podcasts");
            setAll(true);
            setNotice("Hand-picked shows for curious minds.");
          }}
        >
          <Sparkles size={19} />
          Editor's picks
        </button>
        <button
          className="nav-item"
          onClick={() => {
            nav("Discover");
            document.getElementById("trending")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <TrendingUp size={19} />
          Trending now
        </button>
        <div className="sidebar-bottom">
          <div className="listening-card">
            <div className="listening-mark">
              <Headphones size={23} />
              <span className="tiny-star">✳</span>
            </div>
            <h3>
              A little more curious.
              <br />
              Every single day.
            </h3>
            <p>
              Your next favorite podcast
              <br />
              is waiting to be heard.
            </p>
            <button
              onClick={() => {
                nav("Browse");
                searchRef.current?.focus();
              }}
            >
              Find your frequency <ArrowRight size={15} />
            </button>
          </div>
          <button
            className="user-profile"
            onClick={() =>
              setNotice("You’re listening as a guest. Your library is saved on this device.")
            }
          >
            <div className="avatar">J</div>
            <div>
              <b>Jamie Parker</b>
              <span>Free listener</span>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={21} />
            </button>
            <span>Good things are worth listening to.</span>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                ref={searchRef}
                aria-label="Search podcasts and episodes"
                placeholder="Search podcasts, episodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button aria-label="Clear search" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setNotice("You’re all caught up. New episodes arrive every day.")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar top-avatar"
              onClick={() => setNotice("Your library is saved locally on this device.")}
              aria-label="Listener profile"
            >
              J
            </button>
          </div>
        </header>
        <main>
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                <span /> TUNE IN. ZONE OUT.
              </div>
              <h1>
                {search
                  ? "FIND YOUR NEXT LISTEN."
                  : page === "Discover"
                    ? "A WORLD WORTH HEARING."
                    : page === "Browse"
                      ? "FOLLOW YOUR CURIOSITY."
                      : page === "Saved shows"
                        ? "YOUR KIND OF LISTENING."
                        : "PICK UP WHERE YOU LEFT OFF."}
              </h1>
              <p>
                {page === "Saved shows"
                  ? "All your favorites, in one good place."
                  : page === "Recently played"
                    ? "Good conversations are always worth coming back to."
                    : "Fresh perspectives. Real conversations. Find your next obsession."}
              </p>
            </div>
            <div className="today">
              <span>MONDAY, OCT 19</span>
              <div>
                <i /> YOUR NEXT GREAT LISTEN AWAITS
              </div>
            </div>
          </div>
          {isDiscover && (
            <section className="hero">
              <div className="hero-photo" />
              <div className="hero-wash" />
              <div className="hero-noise" />
              <div className="hero-content">
                <div className="featured-label">
                  <Radio size={14} /> THE FEATURED SHOW <span>01 / 03</span>
                </div>
                <h2>
                  OFF THE
                  <br />
                  RECORD<span>®</span>
                </h2>
                <p>No scripts. No filters. Just conversations that stay with you.</p>
                <div className="hero-meta">
                  <span>WITH ALEX MORGAN</span>
                  <i /> SOCIETY & CULTURE <i /> 48 MIN
                </div>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => play(episodes[0])}>
                    <Play size={15} fill="currentColor" /> Start listening
                  </button>
                  <button
                    className={`outline-button ${saved.includes(1) ? "selected" : ""}`}
                    onClick={() => toggleSave(1)}
                  >
                    {saved.includes(1) ? <Check size={16} /> : <Plus size={16} />}{" "}
                    {saved.includes(1) ? "Following" : "Follow show"}
                  </button>
                </div>
              </div>
              <div className="hero-stamp">
                <AudioLines size={30} />
                <span>
                  INDEPENDENT VOICES.
                  <br />
                  UNFORGETTABLE STORIES.
                </span>
              </div>
              <div className="hero-bottom">
                <span>FREQUENCY ORIGINALS</span>
                <div>
                  <button className="slide-dot active" aria-label="Featured show 1" />
                  <button
                    className="slide-dot"
                    aria-label="Preview featured show 2"
                    onClick={() => setDetail(episodes[1])}
                  />
                  <button
                    className="slide-dot"
                    aria-label="Preview featured show 3"
                    onClick={() => setDetail(episodes[2])}
                  />
                </div>
                <button onClick={() => setDetail(episodes[0])}>
                  Explore the show <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}
          {(page === "Discover" || page === "Browse") && !search && (
            <section className="categories-section">
              <div className="section-heading">
                <h2>
                  Follow your curiosity<span className="green-dot">.</span>
                </h2>
                <span className="section-note">A LITTLE SOMETHING FOR EVERY MIND</span>
              </div>
              <div className="category-row">
                {categories.slice(0, 8).map((c, i) => (
                  <button
                    key={c}
                    className={`category ${category === c ? "active" : ""}`}
                    onClick={() => {
                      setCategory(c);
                      setAll(false);
                    }}
                  >
                    {i === 0 && <LayoutGrid size={14} />} {c}
                  </button>
                ))}
                <button
                  className={`category ${category === "News" ? "active" : ""}`}
                  onClick={() => setCategory("News")}
                >
                  News
                </button>
              </div>
            </section>
          )}
          <section className="episodes-section">
            <div className="section-heading">
              <div className="heading-group">
                <h2>
                  {search
                    ? `Results for “${search}”`
                    : page === "Saved shows"
                      ? "Saved shows"
                      : page === "Recently played"
                        ? "Listening history"
                        : page === "Browse"
                          ? "All podcasts"
                          : category !== "All podcasts"
                            ? category
                            : "New updates"}
                  <span className="green-dot">.</span>
                </h2>
                <span className="small-tag">
                  {search || page !== "Discover" ? `${filtered.length} SHOWS` : "FRESH OFF THE MIC"}
                </span>
              </div>
              <button className="text-button" onClick={() => setAll(!all)}>
                {all ? "Show less" : "View all episodes"} <ArrowRight size={15} />
              </button>
            </div>
            {display.length ? (
              <div className="episode-grid">
                {display.map((ep) => (
                  <article className="episode-card" key={ep.id}>
                    <div className="artwork">
                      <button
                        className="artwork-open"
                        aria-label={`View ${ep.show}`}
                        onClick={() => setDetail(ep)}
                      >
                        <Cover ep={ep} />
                      </button>
                      <span className="new-tag">
                        {ep.date === "Today" ? "NEW EPISODE" : ep.category.toUpperCase()}
                      </span>
                      <button
                        className="art-play"
                        aria-label={`Play ${ep.title}`}
                        onClick={() => play(ep)}
                      >
                        {playing && current.id === ep.id ? (
                          <AudioLines size={21} />
                        ) : (
                          <Play size={19} fill="currentColor" />
                        )}
                      </button>
                    </div>
                    <div className="episode-meta">
                      <span>{ep.category}</span>
                      <span>{ep.date}</span>
                    </div>
                    <button className="episode-title" onClick={() => setDetail(ep)}>
                      {ep.title}
                    </button>
                    <p>
                      {ep.show.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
                      <span>· {ep.host}</span>
                    </p>
                    <div className="episode-foot">
                      <span>
                        <Headphones size={12} />
                        {ep.duration}
                      </span>
                      <button
                        aria-label={saved.includes(ep.id) ? `Unsave ${ep.show}` : `Save ${ep.show}`}
                        onClick={() => toggleSave(ep.id)}
                        className={saved.includes(ep.id) ? "is-saved" : ""}
                      >
                        <Bookmark
                          size={16}
                          fill={saved.includes(ep.id) ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Headphones size={34} />
                <h3>
                  {search
                    ? "No shows on this frequency."
                    : page === "Saved shows"
                      ? "Make yourself a little collection."
                      : page === "Recently played"
                        ? "Your listening story starts here."
                        : "More voices are on the way."}
                </h3>
                <p>
                  {page === "Saved shows"
                    ? "Tap the bookmark on any show to save it here."
                    : search
                      ? "Try another title, host, or topic."
                      : "Explore our collection and find something that speaks to you."}
                </p>
                <button className="primary-button" onClick={() => nav("Browse")}>
                  Explore podcasts <ArrowRight size={15} />
                </button>
              </div>
            )}
          </section>
          {isDiscover && (
            <section id="trending" className="trending-section">
              <div className="section-heading">
                <div className="heading-group">
                  <h2>
                    Popular & trending<span className="green-dot">.</span>
                  </h2>
                  <span className="small-tag">
                    <TrendingUp size={12} /> IN HEAVY ROTATION
                  </span>
                </div>
                <div className="row-arrows">
                  <button
                    aria-label="Previous trending shows"
                    onClick={() => setTrendingOffset((trendingOffset + 7) % 8)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    aria-label="Next trending shows"
                    onClick={() => setTrendingOffset((trendingOffset + 1) % 8)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="trending-row">
                {trend.map((ep, i) => (
                  <button className="trending-card" key={ep.id} onClick={() => setDetail(ep)}>
                    <span className="rank">0{i + 1}</span>
                    <Cover ep={ep} mini />
                    <div className="trending-info">
                      <div className="trending-category">{ep.category}</div>
                      <h3>{ep.show.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
                      <p>{ep.host}</p>
                      <span>
                        <TrendingUp size={11} /> Trending this week
                      </span>
                    </div>
                    <Play className="trending-play" size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <AudioLines size={15} /> GOOD STORIES. ZERO NOISE.
            </span>
            <span>Independent voices, all in one place.</span>
            <span>© 2026 Frequency</span>
          </footer>
        </main>
      </div>
      <div className="player">
        <div className="now-playing">
          <button className="player-cover" onClick={() => setDetail(current)}>
            <Cover ep={current} mini />
          </button>
          <div className="playing-copy">
            <div>
              <span className={playing ? "live-indicator animate" : "live-indicator"} />
              {playing ? "NOW PLAYING" : "READY WHEN YOU ARE"}
            </div>
            <b>{current.title}</b>
            <p>
              {current.show.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
              <span>· Audio preview</span>
            </p>
          </div>
          <button
            className={`icon-button player-save ${saved.includes(current.id) ? "is-saved" : ""}`}
            aria-label="Save current show"
            onClick={() => toggleSave(current.id)}
          >
            <Bookmark size={17} fill={saved.includes(current.id) ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="playback">
          <div className="playback-buttons">
            <button
              className="speed"
              onClick={() => setSpeed((s) => (s === 2 ? 0.75 : s + 0.25))}
              aria-label="Change playback speed"
            >
              {speed}×
            </button>
            <button aria-label="Previous episode" onClick={() => next(-1)}>
              <SkipBack size={16} fill="currentColor" />
            </button>
            <button
              aria-label="Rewind 15 seconds"
              className="skip-seconds"
              onClick={() => seek(position - 15)}
            >
              <RotateCcw size={20} />
              <span>15</span>
            </button>
            <button
              className="main-play"
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <button
              aria-label="Forward 15 seconds"
              className="skip-seconds"
              onClick={() => seek(position + 15)}
            >
              <RotateCw size={20} />
              <span>15</span>
            </button>
            <button aria-label="Next episode" onClick={() => next(1)}>
              <SkipForward size={16} fill="currentColor" />
            </button>
            <span className="preview-label">PREVIEW</span>
          </div>
          <div className="timeline">
            <span>{time(position)}</span>
            <input
              aria-label="Playback progress"
              type="range"
              min={0}
              max={duration || 1}
              step="0.1"
              value={position}
              onChange={(e) => seek(+e.target.value)}
              style={
                {
                  "--progress": `${duration ? (position / duration) * 100 : 0}%`,
                } as React.CSSProperties
              }
            />
            <span>{time(duration)}</span>
          </div>
        </div>
        <div className="player-extras">
          <button
            className="icon-button"
            aria-label={volume ? "Mute" : "Unmute"}
            onClick={() => setVolume(volume ? 0 : 0.7)}
          >
            {volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
          />
          <span className="extra-divider" />
          <button
            className={`icon-button ${queue ? "is-saved" : ""}`}
            aria-label="Open play queue"
            onClick={() => setQueue(!queue)}
          >
            <ListMusic size={20} />
          </button>
        </div>
        <audio
          aria-label="Sample narration preview"
          ref={audio}
          src="/audio/preview.wav"
          preload="metadata"
          onLoadedMetadata={() => setDuration(audio.current?.duration || 0)}
          onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)}
          onEnded={() => setPlaying(false)}
        >
          <track kind="captions" src="/audio/preview.vtt" srcLang="en" label="English" default />
        </audio>
      </div>
      {notice && (
        <output className="toast">
          <Check size={16} />
          {notice}
          <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </output>
      )}
      {detail && (
        <div className="modal-overlay">
          <section className="show-modal" aria-label="Show details">
            <button
              className="close-modal icon-button"
              aria-label="Close show details"
              onClick={() => setDetail(null)}
            >
              <X size={22} />
            </button>
            <Cover ep={detail} />
            <div className="show-modal-copy">
              <span className="eyebrow">{detail.category} · FREQUENCY ORIGINAL</span>
              <h2>{detail.show}</h2>
              <p className="modal-host">Hosted by {detail.host}</p>
              <p>{detail.description}</p>
              <button
                className="primary-button"
                onClick={() => {
                  play(detail);
                  setDetail(null);
                }}
              >
                <Play size={16} fill="currentColor" /> Play audio preview
              </button>
              <button className="outline-button" onClick={() => toggleSave(detail.id)}>
                {saved.includes(detail.id) ? <Check size={16} /> : <Plus size={16} />}{" "}
                {saved.includes(detail.id) ? "Following" : "Follow show"}
              </button>
              <div className="modal-episode">
                <span>LATEST EPISODE · {detail.duration}</span>
                <h3>{detail.title}</h3>
                <p>
                  Curated demo show. Playback uses a short sample narration, not a full episode.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
      {queue && (
        <div className="queue-panel">
          <div className="section-heading">
            <h2>Up next</h2>
            <button aria-label="Close queue" onClick={() => setQueue(false)}>
              <X size={19} />
            </button>
          </div>
          <p>A little more for your ears.</p>
          {episodes
            .filter((e) => e.id !== current.id)
            .slice(0, 4)
            .map((e) => (
              <button
                className="queue-item"
                key={e.id}
                onClick={() => {
                  play(e);
                  setQueue(false);
                }}
              >
                <Cover ep={e} mini />
                <div>
                  <b>{e.title}</b>
                  <span>
                    {e.host} · {e.duration}
                  </span>
                </div>
                <Play size={15} />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
