import mongoose from 'mongoose'

export const connectDB = async (): Promise<void> => {
  mongoose.connection.on('connected', () => {
    console.log('MongoDB conectado!')
  })
  mongoose.connection.on('error', (err) => {
    console.log('MongoDB erro:', err.message)
  })
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB desligado — a reconectar...')
  })

  await mongoose.connect(process.env.MONGO_URI as string, {
    serverSelectionTimeoutMS: 60000,
    heartbeatFrequencyMS: 2000,
  })
}