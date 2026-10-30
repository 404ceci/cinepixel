export interface MovieSummary {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number | null
  user_score: number | null
}

export interface MoviePage {
  page: number
  total_pages: number
  total_results: number
  mode: 'search' | 'discover'
  results: MovieSummary[]
}

export interface CastMember {
  id: number
  name: string
  character: string | null
  profile_path: string | null
}

export interface Rating {
  movie_id: number
  score: number
  title: string
  poster_path: string | null
  release_date: string | null
  created_at: string
  updated_at: string
}

export interface MovieDetail {
  id: number
  title: string
  original_title: string | null
  overview: string
  tagline: string
  release_date: string | null
  runtime: number | null
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number | null
  genres: string[]
  directors: string[]
  cast: CastMember[]
  user_rating: Rating | null
}

export interface Genre {
  id: number
  name: string
}

export type RatingSort = 'recent' | 'score' | 'title'

export interface MovieFilters {
  query: string
  genre: number | null
  year: number | null
}

export interface User {
  id: number
  email: string
}

export interface Session {
  token: string
  user: User
}
