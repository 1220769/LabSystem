import mongoose from 'mongoose'

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string)
    console.log(`MongoDB conectado: ${conn.connection.host}`)
  } catch (err) {
    console.error('Erro MongoDB:', err)
    process.exit(1)
  }
}